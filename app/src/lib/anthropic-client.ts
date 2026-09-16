// Appel Anthropic partagé par ai-advisor.ts/ai-search.ts/ai-compare.ts/
// ai-listing.ts (Lot 97) — les 4 répétaient le même bloc fetch/headers/
// extraction de texte, seuls le system prompt, les messages, max_tokens et le
// post-traitement du texte renvoyé (JSON structuré vs texte libre) diffèrent
// réellement, donc restent dans chaque fichier appelant.
export const ANTHROPIC_MODEL = "claude-sonnet-5";

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

  const data = (await res.json()) as { content?: { text?: string }[] };
  const text = data.content?.[0]?.text;
  return typeof text === "string" && text.trim() ? text : null;
}
