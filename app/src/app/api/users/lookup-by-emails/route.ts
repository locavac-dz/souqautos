import { NextRequest, NextResponse } from "next/server";
import { requireUser, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  emails: z.array(z.string().email()).min(1).max(49),
});

// POST /api/users/lookup-by-emails
// Résout une liste d'emails en { id, email } pour la création de groupes.
// Répond avec { users, notFound } — les emails inconnus sont dans notFound[].
// Lot 267 (audit B6) — 20 appels par heure et par compte : sans plafond, 49 adresses par requête permettaient
// d'énumérer les inscrits en quelques minutes.
export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (!(await checkRateLimit(`lookup-emails:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, schema);
  if (body instanceof NextResponse) return body;

  const emails = [...new Set(body.emails.map((e) => e.toLowerCase()))];

  const found = await prisma.user.findMany({
    where: { email: { in: emails }, deletedAt: null },
    select: { id: true, email: true },
  });

  const foundEmails = new Set(found.map((u) => u.email.toLowerCase()));
  const notFound = emails.filter((e) => !foundEmails.has(e));

  return NextResponse.json({ users: found, notFound });
}
