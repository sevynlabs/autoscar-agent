import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { appendMessages } from '../conversation/conversation.service.js';
import { buildSystemPrompt, getActiveAgent } from './agent.prompts.js';
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

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(ctx.lead, activeAgent?.systemPrompt) },
    ...ctx.history,
    { role: 'user', content: ctx.userMessage },
  ];

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
