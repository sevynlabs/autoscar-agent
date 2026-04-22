import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { appendMessages } from '../conversation/conversation.service.js';
import { buildSystemPrompt, detectMissingIdentity, detectTriggerCodeMatch, getActiveAgent } from './agent.prompts.js';
import { AGENT_TOOLS, executeToolCall } from './agent.tools.js';
import type { AgentContext } from './agent.types.js';

const MAX_ITERATIONS = 10;

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY must be set');
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

export async function runAgentTurn(ctx: AgentContext): Promise<string> {
  const client = getOpenAI();

  // Load active agent config from DB (cached 1 min)
  const activeAgent = await getActiveAgent();
  const agentModel = activeAgent?.model ?? 'gpt-4o';
  const agentTemp = activeAgent?.temperature ?? 0.7;

  const codeMatch = detectTriggerCodeMatch(
    ctx.userMessage,
    activeAgent?.triggerVehicleUrls,
    activeAgent?.triggerVehicleCodes,
  );

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(ctx.lead, activeAgent?.systemPrompt, activeAgent?.triggerVehicleUrls, activeAgent?.triggerVehicleCodes) },
    ...ctx.history,
    { role: 'user', content: ctx.userMessage },
  ];

  if (codeMatch) {
    // Persist the URL on the lead immediately — don't depend on the LLM
    // calling scrape_vehicle. This guarantees the sellers-group notification
    // and any downstream flow has the right vehicle link.
    if (ctx.lead) {
      try {
        const { updateLead } = await import('../crm/lead.service.js');
        await updateLead(ctx.lead.id, { vehicleUrl: codeMatch.url });
        ctx.lead.vehicleUrl = codeMatch.url;
      } catch { /* non-critical */ }
    }

    messages.push({
      role: 'system',
      content: `CODIGO DETECTADO: o lead enviou o codigo "${codeMatch.code}". Esse codigo corresponde ao veiculo na URL abaixo:
URL_DO_VEICULO: ${codeMatch.url}

INSTRUCOES OBRIGATORIAS:
- Use scrape_vehicle com a URL acima AGORA para buscar os dados reais do veiculo
- NA SUA RESPOSTA AO LEAD, NUNCA mencione o codigo numerico ("${codeMatch.code}"). O codigo e um identificador interno — nao faz sentido pro lead
- SEMPRE use a URL do veiculo (${codeMatch.url}) nas mensagens pro lead, NUNCA o codigo
- Ja esta decidido qual e o veiculo — nao pergunte ao lead qual carro ele quer
- Se scrape_vehicle falhar, ainda assim apresente o link ${codeMatch.url} ao lead`,
    });
  }

  const missingIdentity = await detectMissingIdentity(ctx.lead, ctx.conversationId);
  if (missingIdentity) {
    const lista = missingIdentity.missing.join(' e ');
    messages.push({
      role: 'system',
      content: `DADOS PENDENTES: ja faz ${missingIdentity.minutesSinceLastAgent} minutos desde sua ultima mensagem e o lead ainda nao informou ${lista}. Nesta resposta, pergunte novamente de forma humanizada e explique o motivo: voce precisa desses dados para passar o atendimento pro consultor certo, que vai fazer um atendimento personalizado. Nao seja robotico, seja direto e amigavel.`,
    });
  }

  // Save the incoming lead message
  await appendMessages(ctx.conversationId, [
    { role: 'lead', content: ctx.userMessage },
  ]);

  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await client.chat.completions.create({
      model: agentModel,
      temperature: agentTemp,
      messages,
      tools: AGENT_TOOLS,
      tool_choice: 'auto',
    });

    if (response.usage) {
      console.log(JSON.stringify({
        level: 'info', msg: 'Agent tokens',
        iteration: iterations,
        tokens: response.usage.total_tokens,
      }));
    }

    const assistantMsg = response.choices[0].message;
    messages.push(assistantMsg as ChatCompletionMessageParam);

    // No tool calls — final text reply
    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
      const reply = assistantMsg.content ?? '';
      if (reply.trim()) {
        await appendMessages(ctx.conversationId, [
          { role: 'agent', content: reply },
        ]);
      }
      return reply;
    }

    // Execute tool calls
    for (const toolCall of assistantMsg.tool_calls) {
      if (toolCall.type !== 'function') continue;
      try {
        const result = await executeToolCall(toolCall, ctx);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        } as ChatCompletionMessageParam);
      } catch (err) {
        const errorContent = err instanceof Error ? err.message : String(err);
        console.log(JSON.stringify({ level: 'error', msg: 'Tool call failed', tool: toolCall.function.name, error: errorContent }));
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: errorContent }),
        } as ChatCompletionMessageParam);
      }
    }
  }

  // MAX_ITERATIONS — fallback
  const fallback = 'Desculpe, tive um problema tecnico. Um vendedor vai entrar em contato em breve.';
  await appendMessages(ctx.conversationId, [{ role: 'agent', content: fallback }]);
  return fallback;
}
