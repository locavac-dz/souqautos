import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateReportSubmission } from "@/lib/reports";

const bodySchema = z.object({
  reason: z.enum([
    "PRIX_SUSPECT",
    "FRAUDE_SUSPECTEE",
    "VEHICULE_VOLE",
    "DOUBLON",
    "CONTENU_INAPPROPRIE",
    "AUTRE",
  ]),
  comment: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`report-listing:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (listing.sellerId === user.id) {
    return NextResponse.json({ error: "cannot_report_own_listing" }, { status: 400 });
  }

  const validation = validateReportSubmission(parsed.data);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const existing = await prisma.report.findUnique({
    where: { listingId_authorId: { listingId: id, authorId: user.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "already_reported" }, { status: 409 });
  }

  await prisma.report.create({
    data: {
      listingId: id,
      authorId: user.id,
      reason: parsed.data.reason,
      comment: parsed.data.comment?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
