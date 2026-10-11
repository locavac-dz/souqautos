import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireRole, parseJsonBody } from "@/lib/api-route";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/auth-server/roles";
import {
  computeReportTransition,
  shouldAutoSuspendListing,
  shouldAutoSuspendUser,
  type ReportModerationAction,
} from "@/lib/reports";
import { writeAuditLog } from "@/lib/audit-log";
import { CLEAR_ASSIGNMENT } from "@/lib/moderation-assignment";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { sendAccountSuspendedEmail } from "@/lib/account-suspension-email";
import { getModerationSettings } from "@/lib/moderation-settings";
import { removedAfterReportUpdate } from "@/lib/owner-review";
import { sendOwnerReviewDecisionEmail } from "@/lib/owner-review-email";

const bodySchema = z.object({
  action: z.enum(["resolve", "dismiss"]),
  note: z.string().trim().max(500).optional(),
});

export const POST = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole(isStaff);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const report = await prisma.report.findUnique({
    where: { id },
    include: { author: true, listing: true, ownerReview: true },
  });
  if (!report) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const action: ReportModerationAction = body.action;
  const transition = computeReportTransition(report.status, action);
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 400 });
  }

  await prisma.report.update({
    where: { id },
    data: {
      status: transition.newStatus,
      resolutionNote: body.note?.trim() || null,
      resolvedAt: new Date(),
      // Lot 277 — la décision efface la prise en charge.
      ...CLEAR_ASSIGNMENT,
    },
  });

  await writeAuditLog({
    adminId: user.id,
    action: `report.${action}`,
    targetType: "Report",
    targetId: id,
    details: {
      listingId: report.listingId,
      reportedUserId: report.reportedUserId,
      ownerReviewId: report.ownerReviewId,
      previousStatus: report.status,
      newStatus: transition.newStatus,
      note: body.note ?? null,
    },
  });

  // Notification à l'auteur du signalement — jamais la note interne du
  // modérateur (cf. commentaire du schéma sur resolutionNote), seulement le
  // résultat (confirmé / rejeté).
  const t = await getTranslations({ locale: report.author.locale, namespace: "Notifications" });
  const targetDescription = report.listing
    ? t("targetDescriptionListing", { title: escapeHtml(report.listing.title) })
    : report.ownerReviewId
      ? t("targetDescriptionOwnerReview")
      : t("targetDescriptionUser");
  const subject = action === "resolve" ? t("reportResolvedSubject") : t("reportDismissedSubject");
  const bodyText =
    action === "resolve"
      ? t("reportResolvedBody", { targetDescription })
      : t("reportDismissedBody", { targetDescription });

  const emailResult = await sendEmail({
    to: report.author.email,
    subject,
    html: `<p>${t("greeting")}</p><p>${bodyText}</p>`,
  }).catch((err) => {
    console.error(`[EMAIL notification signalement traité] échec envoi: ${(err as Error).message}`);
    return null;
  });
  if (emailResult?.previewUrl) {
    console.log(`[EMAIL notification signalement traité] ${emailResult.previewUrl}`);
  }

  // Lot 116 — signalement CONFIRMÉ d'un avis de propriétaire : l'avis est retiré
  // (jamais sur un signalement seulement ouvert ou rejeté), son auteur en est
  // informé avec le motif. Idempotent : un avis déjà retiré n'est pas retraité.
  if (action === "resolve" && report.ownerReviewId && report.ownerReview?.status === "PUBLIE") {
    await prisma.ownerReview.update({
      where: { id: report.ownerReviewId },
      data: removedAfterReportUpdate(new Date()),
    });
    await writeAuditLog({
      adminId: user.id,
      action: "owner_review.remove_after_report",
      targetType: "OwnerReview",
      targetId: report.ownerReviewId,
      details: { triggeredByReportId: id },
    });
    await sendOwnerReviewDecisionEmail(report.ownerReviewId, "removed");
  }

  // Suspension automatique : uniquement pour les annonces (aucune notion de
  // « compte suspendu » n'existe encore), et uniquement sur des signalements
  // CONFIRMÉS (jamais un signalement encore ouvert ou rejeté) — cf. décision
  // du Lot 9 de ne jamais laisser un signalement non vérifié déclencher une
  // action punitive automatique.
  if (action === "resolve" && report.listingId && report.listing) {
    const { autoSuspendListingThreshold } = await getModerationSettings();
    const confirmedReportCount = await prisma.report.count({
      where: { listingId: report.listingId, status: "TRAITE" },
    });
    if (
      shouldAutoSuspendListing(confirmedReportCount, autoSuspendListingThreshold) &&
      report.listing.status === "PUBLIEE"
    ) {
      await prisma.listing.update({
        where: { id: report.listingId },
        data: {
          status: "SUSPENDUE",
          moderationNote: "Suspendue automatiquement après plusieurs signalements confirmés.",
        },
      });
      await writeAuditLog({
        adminId: user.id,
        action: "listing.auto_suspend",
        targetType: "Listing",
        targetId: report.listingId,
        details: { confirmedReportCount, triggeredByReportId: id },
      });
    }
  }

  // Même principe pour les signalements d'utilisateur (Lot 31) : jamais sur un
  // compte déjà suspendu (idempotent), jamais sur un compte du staff (défense
  // en profondeur, même règle que la suspension manuelle — cf. user-suspension.ts).
  if (action === "resolve" && report.reportedUserId) {
    const { autoSuspendUserThreshold } = await getModerationSettings();
    const confirmedReportCount = await prisma.report.count({
      where: { reportedUserId: report.reportedUserId, status: "TRAITE" },
    });
    if (shouldAutoSuspendUser(confirmedReportCount, autoSuspendUserThreshold)) {
      const targetUser = await prisma.user.findUnique({ where: { id: report.reportedUserId } });
      if (targetUser && !targetUser.suspendedAt && !isStaff(targetUser.role)) {
        const autoSuspendReason = "Suspendu automatiquement après plusieurs signalements confirmés.";
        await prisma.user.update({
          where: { id: report.reportedUserId },
          data: { suspendedAt: new Date(), suspensionReason: autoSuspendReason },
        });
        await writeAuditLog({
          adminId: user.id,
          action: "user.auto_suspend",
          targetType: "User",
          targetId: report.reportedUserId,
          details: { confirmedReportCount, triggeredByReportId: id },
        });
        await sendAccountSuspendedEmail(report.reportedUserId, autoSuspendReason);
      }
    }
  }

  return NextResponse.json({ status: transition.newStatus });
});
