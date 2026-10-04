import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isStaff } from "@/lib/auth-server/roles";
import { computeModerationTransition, type ModerationAction } from "@/lib/moderation";
import { writeAuditLog } from "@/lib/audit-log";
import { notifyMatchingSearchAlerts } from "@/lib/search-alerts";
import { notifyProFollowers } from "@/lib/pro-follow";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";
import { createNotification } from "@/lib/notification-service";

const bodySchema = z.object({
  action: z.enum(["approve", "reject", "suspend"]),
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

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const action: ModerationAction = parsed.data.action;
  const transition = computeModerationTransition(listing.status, action, parsed.data.reason);
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 400 });
  }

  const isApproval = action === "approve";
  const moderationNote = isApproval ? null : (parsed.data.reason?.trim() ?? null);
  const publishedAt = isApproval && !listing.publishedAt ? new Date() : listing.publishedAt;

  // Deux membres du staff pourraient modérer la même annonce en même temps
  // (deux onglets, double-clic) : `findUnique` ci-dessus ne protège pas
  // contre cette course. `updateMany` filtré sur le statut LU (pas un
  // statut fixe : approve part d'EN_ATTENTE ou SUSPENDUE, suspend part de
  // PUBLIEE) est atomique — si `count` vaut 0, une autre requête a déjà
  // tranché entre-temps. Même correctif que sur PaymentOrder (Lot 69).
  const { count } = await prisma.listing.updateMany({
    where: { id, status: listing.status },
    data: { status: transition.newStatus, moderationNote, publishedAt },
  });
  if (count === 0) {
    return NextResponse.json({ error: "invalid_transition" }, { status: 400 });
  }
  const updatedListing = { ...listing, status: transition.newStatus, moderationNote, publishedAt };

  if (isApproval) {
    await notifyMatchingSearchAlerts(updatedListing);
    await notifyProFollowers({ id: updatedListing.id, title: updatedListing.title, sellerId: updatedListing.sellerId });
  }

  // Écart trouvé en explorant le code (même famille que le Lot 62) : le
  // vendeur n'était jamais informé de l'issue de la modération — il ne
  // pouvait le découvrir qu'en revisitant lui-même « Mes annonces ».
  const seller = await prisma.user.findUnique({ where: { id: listing.sellerId } });
  if (seller) {
    const t = await getTranslations({ locale: seller.locale, namespace: "Notifications" });
    const title = escapeHtml(listing.title);
    const reason = escapeHtml(parsed.data.reason?.trim() ?? "");

    let subject: string;
    let html: string;
    if (action === "approve") {
      subject = t("listingApprovedSubject");
      html = `<p>${t("greeting")}</p><p>${t("listingApprovedBody", { title })}</p><p><a href="${SITE_URL}/${seller.locale}/annonce/${id}">${t("listingApprovedLink")}</a></p>`;
    } else if (action === "reject") {
      subject = t("listingRejectedSubject");
      html = `<p>${t("greeting")}</p><p>${t("listingRejectedBody", { title, reason })}</p><p><a href="${SITE_URL}/${seller.locale}/compte/mes-annonces">${t("listingRejectedLink")}</a></p>`;
    } else {
      subject = t("listingSuspendedSubject");
      html = `<p>${t("greeting")}</p><p>${t("listingSuspendedBody", { title, reason })}</p><p><a href="${SITE_URL}/${seller.locale}/compte/mes-annonces">${t("listingSuspendedLink")}</a></p>`;
    }

    const emailResult = await sendEmail({ to: seller.email, subject, html }).catch((err) => {
      console.error(`[EMAIL modération annonce] échec envoi: ${(err as Error).message}`);
      return null;
    });
    if (emailResult?.previewUrl) {
      console.log(`[EMAIL modération annonce] ${emailResult.previewUrl}`);
    }

    const notifKind =
      action === "approve" ? "LISTING_APPROVED" :
      action === "reject"  ? "LISTING_REJECTED" :
                             "LISTING_SUSPENDED";
    const notifUrl = action === "approve"
      ? `/${seller.locale}/annonce/${id}`
      : `/${seller.locale}/compte/mes-annonces`;
    await createNotification(listing.sellerId, notifKind, {
      url: notifUrl,
      body: listing.title,
    });
  }

  await writeAuditLog({
    adminId: user.id,
    action: `listing.${action}`,
    targetType: "Listing",
    targetId: id,
    details: {
      previousStatus: listing.status,
      newStatus: transition.newStatus,
      reason: parsed.data.reason ?? null,
    },
  });

  return NextResponse.json({ status: transition.newStatus });
}
