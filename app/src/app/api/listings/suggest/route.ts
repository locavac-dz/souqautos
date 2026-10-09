import { NextRequest, NextResponse } from "next/server";
import { requireUser, parseJsonBody } from "@/lib/api-route";
import { checkRateLimit } from "@/lib/rate-limit";
import { listingSuggestionInputSchema } from "@/lib/validation/listing-suggestion";
import { generateListingSuggestion } from "@/lib/ai-listing";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  // Limite volontairement resserrée : un appel IA a un coût réel dès qu'une
  // clé Anthropic est configurée, même si aucun coût n'est engagé aujourd'hui
  // (repli heuristique sans clé, cf. src/lib/ai-listing.ts).
  if (!(await checkRateLimit(`listing-suggest:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, listingSuggestionInputSchema);
  if (body instanceof NextResponse) return body;

  const suggestion = await generateListingSuggestion(body);

  return NextResponse.json(suggestion);
}
