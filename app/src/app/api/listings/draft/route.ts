import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkDraftPayload } from "@/lib/wizard-draft";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const draft = await prisma.listingDraft.findUnique({ where: { userId: user.id } });
  if (!draft) {
    return NextResponse.json({ draft: null });
  }

  let data: unknown;
  try {
    data = JSON.parse(draft.data);
  } catch {
    // Brouillon corrompu (ne devrait jamais arriver, écrit uniquement par
    // cette même route) — traité comme absent plutôt que de faire échouer
    // la reprise de l'assistant.
    return NextResponse.json({ draft: null });
  }

  return NextResponse.json({ draft: { data, updatedAt: draft.updatedAt } });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!checkRateLimit(`wizard-draft:${user.id}`, { limit: 120, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const check = checkDraftPayload(body?.data);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const draft = await prisma.listingDraft.upsert({
    where: { userId: user.id },
    create: { userId: user.id, data: JSON.stringify(body.data) },
    update: { data: JSON.stringify(body.data) },
  });

  return NextResponse.json({ updatedAt: draft.updatedAt });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  await prisma.listingDraft.deleteMany({ where: { userId: user.id } });

  return NextResponse.json({ ok: true });
}
