// Appel Anthropic partagé par ai-advisor.ts/ai-search.ts/ai-compare.ts/
// ai-listing.ts (Lot 97) et photo-ai.ts (Lot 247, multimodal).
//
// Lot 268 (audit B4) — chaque appel a un délai maximal (`timeoutMs`, 20 s par défaut ; 3 s quand il est dans
// le chemin de rendu d'une page). Sans lui, un appel bloqué tenait la réponse jusqu'au délai d'undici (300 s).
// Un délai dépassé ou une erreur réseau rendent `null`, comme une réponse HTTP en erreur.
export const ANTHROPIC_MODEL = "claude-sonnet-5";
export const DEFAULT_ANTHROPIC_TIMEOUT_MS = 20_000;

function extractText(data: unknown): string | null {
  const d = data as { content?: { text?: string }[] };
  const text = d.content?.[0]?.text;
  return typeof text === "string" && text.trim() ? text : null;
}

async function postMessages(body: Record<string, unknown>, timeoutMs: number): Promise<string | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, ...body }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return extractText(await res.json());
  } catch (err) {
    console.error(`[anthropic] appel abandonné : ${(err as Error).name === "TimeoutError" ? `délai de ${timeoutMs} ms dépassé` : (err as Error).message}`);
    return null;
  }
}

export async function callAnthropicMessages(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
  timeoutMs?: number;
}): Promise<string | null> {
  return postMessages(
    { max_tokens: params.maxTokens, system: params.system, messages: params.messages },
    params.timeoutMs ?? DEFAULT_ANTHROPIC_TIMEOUT_MS
  );
}

// Lot 247 — appel multimodal avec une image JPEG encodée en base64.
// Redimensionner le buffer à ~400 px avant l'appel pour réduire les coûts
// (fait dans photo-ai.ts, pas ici : ce client reste générique).
export async function callAnthropicVision(params: {
  system: string;
  imageBuffer: Buffer;
  prompt: string;
  maxTokens: number;
  timeoutMs?: number;
}): Promise<string | null> {
  return postMessages(
    {
      max_tokens: params.maxTokens,
      system: params.system,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: params.imageBuffer.toString("base64") } },
            { type: "text", text: params.prompt },
          ],
        },
      ],
    },
    params.timeoutMs ?? DEFAULT_ANTHROPIC_TIMEOUT_MS
  );
}
