import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { listingSuggestionInputSchema } from "@/lib/validation/listing-suggestion";
import { generateListingSuggestion } from "@/lib/ai-listing";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Limite volontairement resserrée : un appel IA a un coût réel dès qu'une
  // clé Anthropic est configurée, même si aucun coût n'est engagé aujourd'hui
  // (repli heuristique sans clé, cf. src/lib/ai-listing.ts).
  if (!(await checkRateLimit(`listing-suggest:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = listingSuggestionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const suggestion = await generateListingSuggestion(parsed.data);

  return NextResponse.json(suggestion);
}
