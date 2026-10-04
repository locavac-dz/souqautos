// Appel Anthropic partagé par ai-advisor.ts/ai-search.ts/ai-compare.ts/
// ai-listing.ts (Lot 97) et photo-ai.ts (Lot 247, multimodal).
export const ANTHROPIC_MODEL = "claude-sonnet-5";

function extractText(data: unknown): string | null {
  const d = data as { content?: { text?: string }[] };
  const text = d.content?.[0]?.text;
  return typeof text === "string" && text.trim() ? text : null;
}

export async function callAnthropicMessages(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
}): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: params.messages,
    }),
  });

  if (!res.ok) return null;
  return extractText(await res.json());
}

// Lot 247 — appel multimodal avec une image JPEG encodée en base64.
// Redimensionner le buffer à ~400 px avant l'appel pour réduire les coûts
// (fait dans photo-ai.ts, pas ici : ce client reste générique).
export async function callAnthropicVision(params: {
  system: string;
  imageBuffer: Buffer;
  prompt: string;
  maxTokens: number;
}): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: params.imageBuffer.toString("base64"),
              },
            },
            { type: "text", text: params.prompt },
          ],
        },
      ],
    }),
  });

  if (!res.ok) return null;
  return extractText(await res.json());
}
