import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface AgentContext {
  instance: string;
  phoneNumber: string;
  userMessage: string;
  conversationId: string;
  history: ChatCompletionMessageParam[];
  lead: {
    id: string;
    name: string | null;
    phone: string;
    city: string | null;
    creditStatus: string | null;
    paymentMethod: string | null;
    vehicleUrl: string | null;
    stage: { name: string } | null;
  } | null;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
