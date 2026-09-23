import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { respondOfferSchema } from "@/lib/validation/offer";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { sendPushToUser } from "@/lib/push-send";
import { SITE_URL } from "@/lib/site";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      listing: { select: { title: true } },
      buyer:   { select: { email: true, locale: true } },
    },
  });

  if (!offer || offer.status !== "PENDING") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = respondOfferSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  const { action } = parsed.data;

  // Seul le vendeur peut accepter/refuser ; seul l'acheteur peut retirer.
  if (action === "WITHDRAWN" && offer.buyerId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if ((action === "ACCEPTED" || action === "DECLINED") && offer.sellerId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.offer.update({ where: { id }, data: { status: action } });
    // Quand une offre est acceptée, on clôture toutes les autres offres en attente sur la même annonce.
    if (action === "ACCEPTED") {
      await tx.offer.updateMany({
        where: { listingId: offer.listingId, status: "PENDING", id: { not: id } },
        data: { status: "DECLINED" },
      });
    }
    return result;
  });

  revalidatePath("/compte/offres");

  after(async () => {
    const buyerLocale = offer.buyer.locale ?? "fr";
    const t = await getTranslations({ locale: buyerLocale, namespace: "Notifications" });
    const offersUrl = `${SITE_URL}/${buyerLocale}/compte/offres`;
    const amountStr = offer.amount.toLocaleString(buyerLocale === "ar" ? "ar-DZ" : "fr-DZ");

    if (action === "ACCEPTED") {
      await sendEmail({
        to: offer.buyer.email,
        subject: t("offerAcceptedSubject", { title: offer.listing.title }),
        html: `<p>${t("greeting")}</p><p>${t("offerAcceptedBody", {
          title: escapeHtml(offer.listing.title),
          amount: amountStr,
        })}</p><p><a href="${offersUrl}">${t("offerAcceptedLink")}</a></p>`,
      }).catch(() => null);

      await sendPushToUser(offer.buyerId, {
        title: t("pushOfferAcceptedTitle"),
        body: t("pushOfferAcceptedBody", { title: offer.listing.title }),
        url: `/${buyerLocale}/compte/offres`,
        tag: `offer-accepted-${offer.id}`,
        lang: buyerLocale === "ar" ? "ar" : "fr",
      });
    } else if (action === "DECLINED") {
      await sendEmail({
        to: offer.buyer.email,
        subject: t("offerDeclinedSubject", { title: offer.listing.title }),
        html: `<p>${t("greeting")}</p><p>${t("offerDeclinedBody", {
          title: escapeHtml(offer.listing.title),
          amount: amountStr,
        })}</p><p><a href="${offersUrl}">${t("offerDeclinedLink")}</a></p>`,
      }).catch(() => null);

      await sendPushToUser(offer.buyerId, {
        title: t("pushOfferDeclinedTitle"),
        body: t("pushOfferDeclinedBody", { title: offer.listing.title }),
        url: `/${buyerLocale}/compte/offres`,
        tag: `offer-declined-${offer.id}`,
        lang: buyerLocale === "ar" ? "ar" : "fr",
      });
    }
  });

  return NextResponse.json({ offer: updated });
}
