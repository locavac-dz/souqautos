import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser, parseJsonBody } from "@/lib/api-route";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { makeOfferSchema } from "@/lib/validation/offer";
import { escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";
import { notifyUser } from "@/lib/notify-user";

export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`offer:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id: listingId } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, sellerId: true, title: true, status: true, seller: { select: { locale: true } } },
  });

  if (!listing || listing.status !== "PUBLIEE") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (listing.sellerId === user.id) {
    return NextResponse.json({ error: "cannot_offer_own_listing" }, { status: 400 });
  }

  // Une seule offre active (PENDING) par acheteur par annonce.
  const existing = await prisma.offer.findFirst({
    where: { listingId, buyerId: user.id, status: "PENDING" },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "offer_pending" }, { status: 400 });
  }

  const body = await parseJsonBody(request, makeOfferSchema);
  if (body instanceof NextResponse) return body;

  const offer = await prisma.offer.create({
    data: {
      listingId,
      buyerId: user.id,
      sellerId: listing.sellerId,
      amount: body.amount,
      message: body.message ?? null,
    },
  });

  after(async () => {
    const sellerLocale = listing.seller.locale ?? "fr";
    const t = await getTranslations({ locale: sellerLocale, namespace: "Notifications" });
    const offerUrl = `${SITE_URL}/${sellerLocale}/compte/offres`;
    const amount = body.amount.toLocaleString(sellerLocale === "ar" ? "ar-DZ" : "fr-DZ");
    const seller = await prisma.user.findUnique({ where: { id: listing.sellerId }, select: { email: true } });
    if (!seller) return;

    // Lot 271 — courriel + push + notification in-app en un appel (notifyUser).
    await notifyUser({
      userId: listing.sellerId,
      kind: "OFFER_RECEIVED",
      url: `/${sellerLocale}/compte/offres`,
      body: listing.title,
      email: {
        tag: "offre",
        to: seller.email,
        subject: t("newOfferSubject", { title: listing.title }),
        html: `<p>${t("greeting")}</p><p>${t("newOfferBody", {
          title: escapeHtml(listing.title),
          amount,
        })}</p><p><a href="${offerUrl}">${t("newOfferLink")}</a></p>`,
      },
      push: {
        title: t("pushNewOfferTitle"),
        body: t("pushNewOfferBody", { title: listing.title, amount }),
        tag: `offer-${offer.id}`,
        lang: sellerLocale === "ar" ? "ar" : "fr",
      },
    });
  });

  return NextResponse.json({ offer }, { status: 201 });
});
