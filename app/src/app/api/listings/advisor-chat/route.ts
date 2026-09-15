import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { runAdvisorTurn } from "@/lib/ai-advisor";
import { searchParamsSchema } from "@/lib/validation/search";
import { buildListingWhere, buildListingOrderBy, listingCardInclude } from "@/lib/search";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

const bodySchema = z
  .object({
    messages: z.array(messageSchema).min(1).max(21),
    locale: z.enum(["fr", "ar"]).default("fr"),
  })
  .refine((b) => b.messages[b.messages.length - 1].role === "user", {
    message: "le dernier message doit venir de l'acheteur",
  });

const RESULTS_LIMIT = 6;

// Un appel IA a un coût réel dès qu'une clé Anthropic est configurée — même
// limite que les autres tours de conversation/génération IA (suggest,
// compare-summary), cf. src/lib/ai-advisor.ts pour le repli heuristique.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`advisor-chat:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const { messages, locale } = parsed.data;
  const t = await getTranslations({ locale, namespace: "AiAdvisor" });

  const [brands, wilayas] = await Promise.all([
    prisma.brand.findMany({ include: { models: { select: { id: true, name: true } } } }),
    prisma.wilaya.findMany({ select: { id: true, nomFr: true, nomAr: true } }),
  ]);

  const turn = await runAdvisorTurn(messages, { brands, wilayas }, locale);

  if (turn.action === "clarify") {
    // En mode IA la question vient du modèle ; en repli heuristique
    // (turn.question toujours null) une question fixe traduite est la seule
    // dégradation honnête possible sans raisonnement réel — même discipline
    // que le repli { q: query } de la recherche en langage naturel (Lot 58).
    return NextResponse.json({
      action: "clarify",
      message: turn.question ?? t("heuristicClarify"),
      filters: turn.filters,
      listings: [],
      totalCount: 0,
      source: turn.source,
    });
  }

  // Jamais les filtres bruts renvoyés par l'IA ou l'heuristique directement
  // dans Prisma : toujours revalidés par le même schéma que /recherche,
  // exactement la forme qu'il valide déjà depuis une vraie query string.
  const searchParams = searchParamsSchema.parse({ ...turn.filters, page: "1" });
  const where = buildListingWhere(searchParams);
  const orderBy = buildListingOrderBy(searchParams.sort);

  const [listings, totalCount] = await Promise.all([
    prisma.listing.findMany({ where, orderBy, take: RESULTS_LIMIT, include: listingCardInclude }),
    prisma.listing.count({ where }),
  ]);

  return NextResponse.json({
    action: "search",
    message: totalCount > 0 ? t("resultsFound", { count: totalCount }) : t("noResults"),
    filters: turn.filters,
    listings,
    totalCount,
    source: turn.source,
  });
}
