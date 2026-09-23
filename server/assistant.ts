import { ENV } from "./_core/env";
import type { InvokeResult, Message } from "./_core/llm";

const MAX_PROMPT_CHARS = 12000;
const MAX_CONTEXT_MESSAGES = 24;
const DEFAULT_MODEL = "claude-sonnet-4-6" as const;
const SYSTEM_PROMPT =
  "You are the OMEGA cloud assistant. Be precise, practical, and honest about what you can or cannot execute. Do not claim to have accessed Termux, the VPS, or external systems unless a separate tool call actually provided that result.";

export const MODEL_OPTIONS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", family: "Anthropic", description: "Balanced reasoning and coding" },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7", family: "Anthropic", description: "Highest-capability reasoning" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", family: "Anthropic", description: "Fast everyday responses" },
  { id: "gpt-5.5", label: "GPT-5.5", family: "OpenAI", description: "Flagship reasoning and coding" },
  { id: "gpt-5", label: "GPT-5", family: "OpenAI", description: "Strong general reasoning" },
  { id: "gpt-5-mini", label: "GPT-5 Mini", family: "OpenAI", description: "Fast, lower-cost workhorse" },
  { id: "gpt-5-nano", label: "GPT-5 Nano", family: "OpenAI", description: "Fastest lightweight option" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", family: "Google", description: "Long-context multimodal reasoning" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview", family: "Google", description: "Fast long-context responses" },
] as const;

export type ChatModel = (typeof MODEL_OPTIONS)[number]["id"];

type IncomingMessage = {
  role?: unknown;
  content?: unknown;
};
type ForgeResponse = InvokeResult;

export function isChatModel(value: unknown): value is ChatModel {
  return MODEL_OPTIONS.some((option) => option.id === value);
}

export function normalizeAssistantMessages(body: unknown): Message[] {
  const payload = body && typeof body === "object" ? body as { messages?: unknown; prompt?: unknown } : {};
  const requestedMessages = Array.isArray(payload.messages)
    ? payload.messages
    : [{ role: "user", content: payload.prompt }];

  return requestedMessages
    .filter((message): message is IncomingMessage => {
      if (!message || typeof message !== "object") return false;
      const candidate = message as IncomingMessage;
      return ["system", "user", "assistant"].includes(String(candidate.role)) && typeof candidate.content === "string";
    })
    .slice(-MAX_CONTEXT_MESSAGES)
    .map(message => ({
      role: message.role as "system" | "user" | "assistant",
      content: String(message.content).slice(0, MAX_PROMPT_CHARS),
    }));
}

export function extractAssistantText(result: ForgeResponse): string {
  const content = result.choices[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map(part => part.text)
      .join("\n")
      .trim();
  }
  return "";
}

export async function completeOmegaAssistant(body: unknown) {
  const payload = body && typeof body === "object" ? body as { model?: unknown } : {};
  const model: ChatModel = isChatModel(payload.model) ? payload.model : DEFAULT_MODEL;
  const messages = normalizeAssistantMessages(body);
  if (!messages.some(message => message.role === "user" && typeof message.content === "string" && message.content.trim())) {
    throw new Error("A user prompt is required.");
  }

  const apiKey = ENV.forgeApiKey;
  if (!apiKey) throw new Error("Forge backend is not configured on this deployment.");
  const baseUrl = (ENV.forgeApiUrl || "https://forge.manus.ai").replace(/\/+$/, "");
  const request: Record<string, unknown> = {
    model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
  };
  if (model.startsWith("gpt-")) request.max_completion_tokens = 1400;
  else request.max_tokens = 1400;

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  const result = await response.json().catch(() => null) as ForgeResponse | { error?: { message?: string } } | null;
  if (!response.ok) {
    throw new Error((result as { error?: { message?: string } } | null)?.error?.message || `Forge request failed (${response.status})`);
  }
  const content = extractAssistantText(result as ForgeResponse);
  if (!content) throw new Error("Forge returned an empty response.");
  return { model: (result as ForgeResponse).model || model, content };
}
