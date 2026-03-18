import { Worker, type Job } from 'bullmq';
import { evolutionClient } from '../../whatsapp/evolution.client.js';
import {
  getVehicleData,
  ScraperValidationError,
  ScraperNavigationError,
} from '../../scraper/scraper.service.js';
import type { MessageJobData } from '../jobs/message.job.js';

let worker: Worker | null = null;

const AUTOSCAR_URL_REGEX = /(https?:\/\/(www\.)?autoscar\.com\.br\S+)/i;

function extractAutoscarUrl(text: string): string | null {
  const match = text.match(AUTOSCAR_URL_REGEX);
  return match ? match[1] : null;
}

function formatVehicleSummary(
  data: { model: string; year: string; km: string; price: string; photos: string[] },
  cached: boolean,
): string {
  return [
    'Encontrei o veiculo:',
    '',
    data.model,
    `Ano: ${data.year}`,
    `KM: ${data.km}`,
    `Preco: ${data.price}`,
    `Fotos: ${data.photos.length} disponivel(is)`,
    '',
    cached ? '(dados do cache)' : '(dados atualizados)',
  ].join('\n');
}

export function startMessageWorker(): Worker {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL must be set');
  }

  worker = new Worker(
    'messages',
    async (job: Job) => {
      const { instance, phoneNumber, message } = job.data as MessageJobData;

      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'Processing message',
          jobId: job.id,
          phone: phoneNumber,
          preview: message.substring(0, 50),
        }),
      );

      try {
        const url = extractAutoscarUrl(message);

        if (url) {
          console.log(
            JSON.stringify({
              level: 'info',
              msg: 'URL detected',
              jobId: job.id,
              url,
            }),
          );

          const result = await getVehicleData(url);

          console.log(
            JSON.stringify({
              level: 'info',
              msg: 'Scrape result',
              jobId: job.id,
              cached: result.cached,
            }),
          );

          const summary = formatVehicleSummary(result.data, result.cached);
          await evolutionClient.sendText(instance, phoneNumber, summary);
        } else {
          // No URL — echo reply (will be replaced by AI agent in Phase 2)
          await evolutionClient.sendText(instance, phoneNumber, `[Echo] ${message}`);
        }

        console.log(
          JSON.stringify({
            level: 'info',
            msg: 'Reply sent',
            jobId: job.id,
            phone: phoneNumber,
          }),
        );
      } catch (err) {
        if (err instanceof ScraperValidationError) {
          const errorMsg = `Nao consegui extrair todos os dados do veiculo. Campos com problema: ${err.fields.join(', ')}`;
          await evolutionClient.sendText(instance, phoneNumber, errorMsg);
        } else if (err instanceof ScraperNavigationError) {
          await evolutionClient.sendText(
            instance,
            phoneNumber,
            'Nao consegui acessar a pagina do veiculo. Tente novamente em alguns minutos.',
          );
        } else {
          console.log(
            JSON.stringify({
              level: 'error',
              msg: 'Unexpected error processing message',
              jobId: job.id,
              phone: phoneNumber,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
          await evolutionClient.sendText(
            instance,
            phoneNumber,
            'Ocorreu um erro ao buscar os dados do veiculo.',
          );
        }
      }
    },
    {
      connection: { url: redisUrl },
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    console.log(
      JSON.stringify({
        level: 'error',
        msg: 'Message job failed',
        jobId: job?.id,
        error: err.message,
      }),
    );
  });

  return worker;
}

export function getMessageWorker(): Worker | null {
  return worker;
}
