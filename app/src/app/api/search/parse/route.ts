import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";
import { parseNaturalLanguageQuery } from "@/lib/ai-search";

const bodySchema = z.object({ query: z.string().trim().min(2).max(200) });

// Route publique (comme /recherche elle-même) : pas d'authentification
// requise, mais limitée par IP — un appel IA a un coût réel dès qu'une clé
// est configurée (cf. src/lib/ai-search.ts, repli sans clé sinon).
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`search-parse:${ip}`, { limit: 30, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const [brands, wilayas] = await Promise.all([
    prisma.brand.findMany({ include: { models: { select: { id: true, name: true } } } }),
    prisma.wilaya.findMany({ select: { id: true, nomFr: true } }),
  ]);

  const result = await parseNaturalLanguageQuery(parsed.data.query, { brands, wilayas });

  return NextResponse.json(result);
}
