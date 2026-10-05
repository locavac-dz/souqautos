import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";

const schema = z.object({
  emails: z.array(z.string().email()).min(1).max(49),
});

// POST /api/users/lookup-by-emails
// Résout une liste d'emails en { id, email } pour la création de groupes.
// Répond avec { users, notFound } — les emails inconnus sont dans notFound[].
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  const emails = [...new Set(parsed.data.emails.map((e) => e.toLowerCase()))];

  const found = await prisma.user.findMany({
    where: { email: { in: emails }, deletedAt: null },
    select: { id: true, email: true },
  });

  const foundEmails = new Set(found.map((u) => u.email.toLowerCase()));
  const notFound = emails.filter((e) => !foundEmails.has(e));

  return NextResponse.json({ users: found, notFound });
}
