import { NextRequest, NextResponse, after } from "next/server";
import { apiHandler, requireUser, parseJsonBody } from "@/lib/api-route";
import { notifyStaffOfPending } from "@/lib/staff-alerts";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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

export const POST = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`report-listing:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (listing.sellerId === user.id) {
    return NextResponse.json({ error: "cannot_report_own_listing" }, { status: 400 });
  }

  const validation = validateReportSubmission(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const existing = await prisma.report.findUnique({
    where: { listingId_authorId: { listingId: id, authorId: user.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "already_reported" }, { status: 409 });
  }

  // Le `findUnique` ci-dessus évite l'aller-retour DB dans le cas courant,
  // mais ne protège pas contre deux soumissions quasi simultanées (double
  // clic, retentative réseau) — la contrainte unique reste la seule garantie
  // réelle contre un doublon, d'où le try/catch P2002 (même discipline que
  // upgrade-formula/route.ts et subscription/upgrade/route.ts).
  try {
    await prisma.report.create({
      data: {
        listingId: id,
        authorId: user.id,
        reason: body.reason,
        comment: body.comment?.trim() || null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "already_reported" }, { status: 409 });
    }
    throw err;
  }

  // Lot 118 — prévient l'équipe (après la réponse).
  after(() => notifyStaffOfPending("report"));

  return NextResponse.json({ ok: true }, { status: 201 });
});
