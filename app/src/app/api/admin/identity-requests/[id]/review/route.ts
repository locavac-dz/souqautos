import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
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
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const identityRequest = await prisma.identityVerificationRequest.findUnique({ where: { id } });
  if (!identityRequest) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const action: IdentityReviewAction = parsed.data.action;
  const transition = computeIdentityReviewTransition(identityRequest.status, action, parsed.data.reason);
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 400 });
  }

  await prisma.identityVerificationRequest.update({
    where: { id },
    data: {
      status: transition.newStatus,
      reviewedById: user.id,
      reviewedAt: new Date(),
      reviewNote: parsed.data.reason?.trim() || null,
      // Aucune conservation indéfinie de la pièce une fois la décision prise.
      documentPath: null,
      documentMime: null,
    },
  });

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
        : `<p>${t("greeting")}</p><p>${t("identityRejectedBody", { reason: escapeHtml(parsed.data.reason?.trim() ?? "") })}</p><p><a href="${dashboardLink}">${t("identityRejectedLink")}</a></p>`;

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
    details: { requesterId: identityRequest.userId, reason: parsed.data.reason ?? null },
  });

  return NextResponse.json({ status: transition.newStatus });
}
