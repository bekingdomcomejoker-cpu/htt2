import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InvokeResult } from "./_core/llm";
import { completeOmegaAssistant, extractAssistantText, normalizeAssistantMessages } from "./assistant";

function result(content: string): InvokeResult {
  return {
    id: "test-response",
    created: 0,
    model: "claude-sonnet-4-6",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  };
}

describe("OMEGA assistant", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(result("OMEGA_ASSISTANT_OK")), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes only safe chat roles and bounds message history", () => {
    const messages = normalizeAssistantMessages({
      messages: [
        { role: "tool", content: "ignore me" },
        ...Array.from({ length: 14 }, (_, index) => ({ role: "user", content: `message-${index}` })),
      ],
    });

    expect(messages).toHaveLength(12);
    expect(messages[0]).toEqual({ role: "user", content: "message-2" });
    expect(messages.at(-1)).toEqual({ role: "user", content: "message-13" });
  });

  it("uses the server-side Forge transport and returns the assistant text", async () => {
    await expect(completeOmegaAssistant({ prompt: "Reply with exactly OMEGA_ASSISTANT_OK" })).resolves.toEqual({
      model: "claude-sonnet-4-6",
      content: "OMEGA_ASSISTANT_OK",
    });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/v1/chat/completions"), expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
    }));
  });

  it("rejects empty prompts before calling Forge", async () => {
    await expect(completeOmegaAssistant({ prompt: "   " })).rejects.toThrow("A user prompt is required.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces an upstream Forge error without exposing the key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "upstream unavailable" } }), {
      status: 503,
      headers: { "content-type": "application/json" },
    })));

    await expect(completeOmegaAssistant({ prompt: "test" })).rejects.toThrow("upstream unavailable");
  });

  it("extracts text parts from multimodal helper responses", () => {
    expect(extractAssistantText({
      ...result("ignored"),
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: [{ type: "text", text: "first" }, { type: "text", text: "second" }],
        },
        finish_reason: "stop",
      }],
    })).toBe("first\nsecond");
  });
});
