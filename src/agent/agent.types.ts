import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface AgentContext {
  instance: string;
  phoneNumber: string;
  userMessage: string;
  conversationId: string;
  history: ChatCompletionMessageParam[];
  sellersGroupJid?: string | null;
  lead: {
    id: string;
    name: string | null;
    phone: string;
    contactPhone: string | null;
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
