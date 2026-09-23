import { ENV } from "./_core/env";
import type { InvokeResult, Message } from "./_core/llm";

const MAX_PROMPT_CHARS = 12000;
const SYSTEM_PROMPT =
  "You are the OMEGA cloud assistant. Be precise, practical, and honest about what you can or cannot execute. Do not claim to have accessed Termux, the VPS, or external systems unless a separate tool call actually provided that result.";

type IncomingMessage = {
  role?: unknown;
  content?: unknown;
};

type ForgeResponse = InvokeResult;

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
    .slice(-12)
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
  const messages = normalizeAssistantMessages(body);
  if (!messages.some(message => message.role === "user" && typeof message.content === "string" && message.content.trim())) {
    throw new Error("A user prompt is required.");
  }

  const apiKey = ENV.forgeApiKey;
  if (!apiKey) throw new Error("Forge backend is not configured on this deployment.");
  const baseUrl = (ENV.forgeApiUrl || "https://forge.manus.ai").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 1400,
    }),
  });
  const payload = await response.json().catch(() => null) as ForgeResponse | { error?: { message?: string } } | null;
  if (!response.ok) {
    throw new Error((payload as { error?: { message?: string } } | null)?.error?.message || `Forge request failed (${response.status})`);
  }
  const content = extractAssistantText(payload as ForgeResponse);
  if (!content) throw new Error("Forge returned an empty response.");
  return { model: (payload as ForgeResponse).model || "claude-sonnet-4-6", content };
}
