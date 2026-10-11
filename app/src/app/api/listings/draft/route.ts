import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkDraftPayload } from "@/lib/wizard-draft";

export const GET = apiHandler(async () => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

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
});

export const PUT = apiHandler(async (request: NextRequest) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`wizard-draft:${user.id}`, { limit: 120, windowMs: 60 * 60 * 1000 }))) {
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
});

export const DELETE = apiHandler(async () => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  await prisma.listingDraft.deleteMany({ where: { userId: user.id } });

  return NextResponse.json({ ok: true });
});
