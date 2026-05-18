import { z } from 'zod';
import type {
  ChatCompletionTool,
  ChatCompletionMessageFunctionToolCall,
} from 'openai/resources/chat/completions';
import { getVehicleData } from '../scraper/scraper.service.js';
import { searchVehicles } from '../scraper/autoscar.search.js';
import { upsertLead, updateLead, moveToStage, addNote } from '../crm/lead.service.js';
import { getDefaultPipeline, getStageByName } from '../crm/pipeline.service.js';
import { evolutionClient } from '../whatsapp/evolution.client.js';
import type { AgentContext } from './agent.types.js';

// ---------- Tool definitions for OpenAI ----------

export const AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_vehicles',
      description: 'Busca veiculos disponiveis no portal autoscar.com.br por modelo, marca ou tipo. Retorna lista com titulo, preco, ano, km, url e foto. Use quando o lead perguntar sobre opcoes de veiculos ou quiser ver o que tem disponivel.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Termo de busca: modelo, marca ou tipo do veiculo (ex: "civic", "corolla", "hilux", "suv")' },
          limit: { type: 'number', description: 'Quantidade maxima de resultados (padrao 5)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scrape_vehicle',
      description: 'Busca dados do veiculo no autoscar.com.br. Retorna modelo, ano, km, preco e link direto do anuncio.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL do veiculo no autoscar.com.br' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_lead',
      description: 'Cria ou atualiza card do lead no CRM',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome do lead' },
          phone: { type: 'string', description: 'Telefone do lead' },
          vehicle_url: { type: 'string', description: 'URL do veiculo de interesse' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lead',
      description: 'Atualiza dados do lead no CRM',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome do lead' },
          phone: { type: 'string', description: 'Telefone/WhatsApp de contato do lead para o vendedor ligar' },
          email: { type: 'string', description: 'Email do lead' },
          city: { type: 'string', description: 'Cidade do lead' },
          vehicle_url: { type: 'string', description: 'URL ou ID do veiculo de interesse' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_lead_stage',
      description: 'Move o card do lead para outra etapa do pipeline',
      parameters: {
        type: 'object',
        properties: {
          stage_name: {
            type: 'string',
            description: 'Nome da etapa: Novo, Em Qualificacao, Qualificado, Desqualificado',
          },
        },
        required: ['stage_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_note',
      description: 'Adiciona nota ao card do lead',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Conteudo da nota' },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notify_sellers_group',
      description: 'Envia resumo do lead qualificado para grupo de vendedores',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Resumo do lead qualificado' },
        },
        required: ['summary'],
      },
    },
  },
];

// ---------- Zod schemas for argument validation ----------

const SearchVehiclesArgs = z.object({ query: z.string(), limit: z.number().optional() });
const ScrapeVehicleArgs = z.object({ url: z.string() });
const CreateLeadArgs = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  vehicle_url: z.string().optional(),
});
const UpdateLeadArgs = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  city: z.string().optional(),
  credit_status: z.string().optional(),
  payment_method: z.string().optional(),
  vehicle_url: z.string().optional(),
});
const MoveStageArgs = z.object({ stage_name: z.string() });
const AddNoteArgs = z.object({ content: z.string() });
const NotifyArgs = z.object({ summary: z.string() });

// ---------- Tool executor ----------

export async function executeToolCall(
  toolCall: ChatCompletionMessageFunctionToolCall,
  ctx: AgentContext,
): Promise<unknown> {
  const args: unknown = JSON.parse(toolCall.function.arguments);

  switch (toolCall.function.name) {
    case 'search_vehicles': {
      const { query, limit } = SearchVehiclesArgs.parse(args);
      const results = await searchVehicles(query, limit ?? 5);
      if (results.length === 0) {
        return { found: 0, message: `Nenhum veiculo encontrado para "${query}" no portal autoscar.com.br` };
      }
      return {
        found: results.length,
        vehicles: results.map(v => ({
          title: v.title,
          price: v.price,
          year: v.year,
          km: v.km,
          link: v.url,
          city: v.city,
          state: v.state,
        })),
      };
    }

    case 'scrape_vehicle': {
      const { url } = ScrapeVehicleArgs.parse(args);
      try {
        const result = await getVehicleData(url);
        const finalUrl = result.fullUrl ?? url.split('?')[0];

        // Auto-persist the vehicle URL on the lead so the sellers-group
        // notification always has the link the conversation is about.
        if (ctx.lead && finalUrl) {
          await updateLead(ctx.lead.id, { vehicleUrl: finalUrl }).catch(() => {});
          ctx.lead.vehicleUrl = finalUrl;
        }

        return {
          model: result.data.model,
          year: result.data.year,
          km: result.data.km,
          price: result.data.price,
          color: result.data.color ?? 'Nao informado',
          fuel: result.data.fuel ?? 'Nao informado',
          transmission: result.data.transmission ?? 'Nao informado',
          city: result.data.city ?? 'Nao informado',
          link: finalUrl,
        };
      } catch (err) {
        console.error('[scrape_vehicle] Error:', err instanceof Error ? err.message : err);
        // Even if the scrape failed, save the URL on the lead — it's still
        // the vehicle of interest for the sellers-group notification.
        if (ctx.lead && url) {
          const cleanUrl = url.split('?')[0];
          await updateLead(ctx.lead.id, { vehicleUrl: cleanUrl }).catch(() => {});
          ctx.lead.vehicleUrl = cleanUrl;
        }
        return { error: `Nao foi possivel buscar o veiculo: ${err instanceof Error ? err.message : err}`, suggestion: 'Tente usar search_vehicles com o nome do modelo para buscar alternativas' };
      }
    }

    case 'create_lead': {
      const data = CreateLeadArgs.parse(args);
      const lead = await upsertLead({
        phone: ctx.phoneNumber,
        name: data.name,
        vehicleUrl: data.vehicle_url,
      });
      return { id: lead.id, name: lead.name, phone: lead.phone, stage: lead.stage?.name };
    }

    case 'update_lead': {
      if (!ctx.lead) throw new Error('No lead in context');
      const data = UpdateLeadArgs.parse(args);
      const lead = await updateLead(ctx.lead.id, {
        name: data.name,
        contactPhone: data.phone,
        email: data.email,
        city: data.city,
        creditStatus: data.credit_status,
        paymentMethod: data.payment_method,
        vehicleUrl: data.vehicle_url,
      });
      if (ctx.lead && data.phone) ctx.lead.contactPhone = data.phone;
      return { id: lead.id, name: lead.name, phone: lead.contactPhone, city: lead.city, stage: lead.stage?.name };
    }

    case 'move_lead_stage': {
      if (!ctx.lead) throw new Error('No lead in context');
      const { stage_name } = MoveStageArgs.parse(args);
      const pipeline = await getDefaultPipeline();
      const stage = await getStageByName(pipeline.id, stage_name);
      if (!stage) {
        return { error: `Stage "${stage_name}" not found in pipeline` };
      }
      // HARD RULE: never qualify without BOTH name and a usable phone.
      const target = stage_name.toLowerCase();
      if (target.includes('qualificado') && !target.includes('des')) {
        const hasUsablePhone = !!(
          ctx.lead.contactPhone?.trim() ||
          (ctx.lead.phone && !ctx.lead.phone.startsWith('web:'))
        );
        if (!ctx.lead.name?.trim() || !hasUsablePhone) {
          return {
            error:
              'Nao e permitido qualificar sem NOME e TELEFONE do lead. Continue pedindo o telefone (DDD + numero) antes de qualificar.',
          };
        }
      }
      const lead = await moveToStage(ctx.lead.id, stage.id);
      return { id: lead.id, stage: lead.stage?.name };
    }

    case 'add_note': {
      if (!ctx.lead) throw new Error('No lead in context');
      const { content } = AddNoteArgs.parse(args);
      const note = await addNote(ctx.lead.id, content, 'ai');
      return { id: note.id, content: note.content };
    }

    case 'notify_sellers_group': {
      // Ignore whatever summary the agent provided — route through the
      // centralized helper so the group ALWAYS receives the full structured
      // summary (name, phone, vehicle + link, conversation link).
      NotifyArgs.parse(args); // still validate the shape
      if (!ctx.lead) {
        console.warn('[agent-tools] notify_sellers_group called without lead context');
        return { skipped: true, reason: 'no lead in context' };
      }
      const { notifySellersGroupForLead } = await import('../crm/seller-notification.service.js');
      const result = await notifySellersGroupForLead(ctx.lead.id, {
        reason: 'Notificação disparada pelo agente',
        force: true,
      });
      return result;
    }

    default:
      throw new Error(`Unknown tool: ${toolCall.function.name}`);
  }
}
