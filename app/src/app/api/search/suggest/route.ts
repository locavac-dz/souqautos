import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";
import { apiHandler } from "@/lib/api-route";

// Renvoie jusqu'à 8 suggestions de saisie à partir des marques, modèles et
// wilayas dont le nom contient la chaîne saisie.
export const GET = apiHandler(async (request: NextRequest) => {
  if (!(await checkRateLimit(`suggest-ip:${getClientIp(request)}`, { limit: 120, windowMs: 60 * 1000 }))) {
    return NextResponse.json([], { status: 429 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const contains = { contains: q, mode: "insensitive" } as const;

  const [brands, models, wilayas] = await Promise.all([
    prisma.brand.findMany({ where: { name: contains }, select: { name: true }, take: 4 }),
    prisma.model.findMany({ where: { name: contains }, select: { name: true }, take: 4 }),
    prisma.wilaya.findMany({
      where: { OR: [{ nomFr: contains }, { nomAr: contains }] },
      select: { nomFr: true },
      take: 4,
    }),
  ]);

  const seen = new Set<string>();
  const suggestions: string[] = [];
  for (const item of [
    ...brands.map((b) => b.name),
    ...models.map((m) => m.name),
    ...wilayas.map((w) => w.nomFr),
  ]) {
    if (!seen.has(item) && suggestions.length < 8) {
      seen.add(item);
      suggestions.push(item);
    }
  }

  return NextResponse.json(suggestions);
});
