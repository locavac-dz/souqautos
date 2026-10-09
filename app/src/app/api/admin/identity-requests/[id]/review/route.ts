import { NextRequest, NextResponse } from "next/server";
import { requireRole, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/auth-server/roles";
import { computeIdentityReviewTransition, type IdentityReviewAction } from "@/lib/identity-verification";
import { deleteIdentityDocument } from "@/lib/identity-uploads";
import { writeAuditLog } from "@/lib/audit-log";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(isStaff);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const identityRequest = await prisma.identityVerificationRequest.findUnique({ where: { id } });
  if (!identityRequest) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const action: IdentityReviewAction = body.action;
  const transition = computeIdentityReviewTransition(identityRequest.status, action, body.reason);
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 400 });
  }

  // Deux membres du staff pourraient traiter le même dossier en même temps
  // (deux onglets, double-clic) : `findUnique` ci-dessus ne protège pas
  // contre cette course. `updateMany` avec le statut EN_ATTENTE dans le
  // `where` est atomique — si `count` vaut 0, une autre requête a déjà
  // tranché entre-temps. Même correctif que sur PaymentOrder (Lot 69).
  const { count } = await prisma.identityVerificationRequest.updateMany({
    where: { id, status: "EN_ATTENTE" },
    data: {
      status: transition.newStatus,
      reviewedById: user.id,
      reviewedAt: new Date(),
      reviewNote: body.reason?.trim() || null,
      // Aucune conservation indéfinie de la pièce une fois la décision prise.
      documentPath: null,
      documentMime: null,
    },
  });
  if (count === 0) {
    return NextResponse.json({ error: "invalid_transition" }, { status: 400 });
  }

  if (identityRequest.documentPath) {
    await deleteIdentityDocument(identityRequest.documentPath);
  }

  if (action === "approve") {
    await prisma.user.update({
      where: { id: identityRequest.userId },
      data: { identityVerifiedAt: new Date() },
    });
  }

  // Écart de la même famille que les Lots 62/63 : le demandeur n'était
  // jamais informé de l'issue de sa vérification d'identité — il ne pouvait
  // le découvrir qu'en revisitant lui-même son tableau de bord.
  const requester = await prisma.user.findUnique({ where: { id: identityRequest.userId } });
  if (requester) {
    const t = await getTranslations({ locale: requester.locale, namespace: "Notifications" });
    const dashboardLink = `${SITE_URL}/${requester.locale}/compte/tableau-de-bord`;

    const subject = action === "approve" ? t("identityApprovedSubject") : t("identityRejectedSubject");
    const html =
      action === "approve"
        ? `<p>${t("greeting")}</p><p>${t("identityApprovedBody")}</p><p><a href="${dashboardLink}">${t("identityApprovedLink")}</a></p>`
        : `<p>${t("greeting")}</p><p>${t("identityRejectedBody", { reason: escapeHtml(body.reason?.trim() ?? "") })}</p><p><a href="${dashboardLink}">${t("identityRejectedLink")}</a></p>`;

    const emailResult = await sendEmail({ to: requester.email, subject, html }).catch((err) => {
      console.error(`[EMAIL vérification identité] échec envoi: ${(err as Error).message}`);
      return null;
    });
    if (emailResult?.previewUrl) {
      console.log(`[EMAIL vérification identité] ${emailResult.previewUrl}`);
    }
  }

  await writeAuditLog({
    adminId: user.id,
    action: `identity_verification.${action}`,
    targetType: "IdentityVerificationRequest",
    targetId: id,
    details: { requesterId: identityRequest.userId, reason: body.reason ?? null },
  });

  return NextResponse.json({ status: transition.newStatus });
}
