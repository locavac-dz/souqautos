import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callAnthropicMessages, callAnthropicVision, DEFAULT_ANTHROPIC_TIMEOUT_MS } from "@/lib/anthropic-client";

// Lot 268 (audit B4) — chaque appel Anthropic a un délai maximal ; un dépassement, une erreur réseau ou une
// réponse en erreur rendent `null`, jamais une exception ni une attente de 300 s.
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const PARAMS = { system: "s", messages: [{ role: "user" as const, content: "bonjour" }], maxTokens: 10 };

describe("callAnthropicMessages", () => {
  it("returns the first text block and passes an abort signal with the default timeout", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ content: [{ text: "réponse" }] }), { status: 200 }));
    expect(await callAnthropicMessages(PARAMS)).toBe("réponse");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body as string)).toMatchObject({ max_tokens: 10, system: "s" });
    expect(DEFAULT_ANTHROPIC_TIMEOUT_MS).toBe(20_000);
  });

  it("gives up after timeoutMs and returns null (the page renders without the AI)", async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason ?? new Error("aborted")));
      })
    );
    const started = Date.now();
    expect(await callAnthropicMessages({ ...PARAMS, timeoutMs: 50 })).toBeNull();
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("returns null on an HTTP error or a network failure", async () => {
    fetchMock.mockResolvedValueOnce(new Response("overloaded", { status: 529 }));
    expect(await callAnthropicMessages(PARAMS)).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    expect(await callAnthropicMessages(PARAMS)).toBeNull();
  });

  it("sends the image as base64 for the vision call, with the same timeout handling", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ content: [{ text: "tags" }] }), { status: 200 }));
    expect(await callAnthropicVision({ system: "s", imageBuffer: Buffer.from("jpeg"), prompt: "p", maxTokens: 5, timeoutMs: 1_000 })).toBe("tags");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.messages[0].content[0].source.data).toBe(Buffer.from("jpeg").toString("base64"));
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });
});
