import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { appendMessages } from '../conversation/conversation.service.js';
import { buildSystemPrompt } from './agent.prompts.js';
import { AGENT_TOOLS, executeToolCall } from './agent.tools.js';
import type { AgentContext } from './agent.types.js';

const MAX_ITERATIONS = 10;

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY must be set');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

export async function runAgentTurn(ctx: AgentContext): Promise<string> {
  const client = getOpenAI();

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(ctx.lead) },
    ...ctx.history,
    { role: 'user', content: ctx.userMessage },
  ];

  // Track new messages added during this turn (for persistence)
  const newMessages: ChatCompletionMessageParam[] = [
    { role: 'user', content: ctx.userMessage },
  ];

  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools: AGENT_TOOLS,
      tool_choice: 'auto',
    });

    // Log token usage
    if (response.usage) {
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'Agent turn tokens',
          iteration: iterations,
          tokens: response.usage.total_tokens,
          prompt: response.usage.prompt_tokens,
          completion: response.usage.completion_tokens,
        }),
      );
    }

    const assistantMsg = response.choices[0].message;
    messages.push(assistantMsg as ChatCompletionMessageParam);
    newMessages.push(assistantMsg as ChatCompletionMessageParam);

    // No tool calls — final reply
    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
      // Persist all new messages
      await appendMessages(ctx.conversationId, newMessages);
      return assistantMsg.content ?? '';
    }

    // Execute each tool call (filter to function type only)
    for (const toolCall of assistantMsg.tool_calls) {
      if (toolCall.type !== 'function') continue;
      try {
        const result = await executeToolCall(toolCall, ctx);
        const toolMsg: ChatCompletionMessageParam = {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        };
        messages.push(toolMsg);
        newMessages.push(toolMsg);
      } catch (err) {
        const errorContent = err instanceof Error ? err.message : String(err);
        console.log(
          JSON.stringify({
            level: 'error',
            msg: 'Tool call failed',
            tool: toolCall.function.name,
            error: errorContent,
          }),
        );
        const toolMsg: ChatCompletionMessageParam = {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: errorContent }),
        };
        messages.push(toolMsg);
        newMessages.push(toolMsg);
      }
    }
  }

  // MAX_ITERATIONS exceeded — fallback
  console.warn(
    JSON.stringify({
      level: 'warn',
      msg: 'Agent hit MAX_ITERATIONS',
      phone: ctx.phoneNumber,
      iterations: MAX_ITERATIONS,
    }),
  );

  await appendMessages(ctx.conversationId, newMessages);
  return 'Desculpe, tive um problema tecnico. Um vendedor vai entrar em contato em breve.';
}
