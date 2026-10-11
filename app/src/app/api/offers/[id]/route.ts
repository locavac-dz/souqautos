import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser, parseJsonBody } from "@/lib/api-route";
import { cancelPendingOrdersForListing } from "@/lib/payment-fulfillment";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { respondOfferSchema, updateOfferSchema } from "@/lib/validation/offer";
import { sendEmailBestEffort, escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notify-user";

// PATCH — vendeur : accepte / refuse / contre-offre ; acheteur : retire / répond à une contre-offre
export const PATCH = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`offer:action:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      listing: { select: { id: true, title: true } },
      buyer:   { select: { email: true, locale: true } },
      seller:  { select: { email: true, locale: true } },
    },
  });

  if (!offer || (offer.status !== "PENDING" && offer.status !== "COUNTERED")) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await parseJsonBody(request, respondOfferSchema);
  if (body instanceof NextResponse) return body;

  const { action, counterAmount } = body;

  // Règles d'autorisation selon le statut courant et l'action demandée
  const isBuyer  = offer.buyerId  === user.id;
  const isSeller = offer.sellerId === user.id;

  if (offer.status === "PENDING") {
    // Sur une offre ordinaire : vendeur accepte/refuse/contre-offre ; acheteur retire
    if (action === "WITHDRAWN"                      && !isBuyer)  return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if ((action === "ACCEPTED" || action === "DECLINED" || action === "COUNTERED") && !isSeller)
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } else {
    // Sur une contre-offre (COUNTERED) : acheteur accepte/refuse/retire ; vendeur ne peut plus rien
    if (!isBuyer) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (action === "COUNTERED")  return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.offer.update({
      where: { id },
      data: {
        status:        action,
        counterAmount: action === "COUNTERED" ? counterAmount : undefined,
      },
    });

    if (action === "ACCEPTED") {
      // Clôture toutes les autres offres PENDING/COUNTERED sur la même annonce
      await tx.offer.updateMany({
        where: { listingId: offer.listingId, status: { in: ["PENDING", "COUNTERED"] }, id: { not: id } },
        data:  { status: "DECLINED" },
      });
      // Marque l'annonce comme vendue
      await tx.listing.update({
        where: { id: offer.listingId },
        data:  { status: "VENDUE" },
      });
      // Lot 265 — plus de formule à activer sur une annonce vendue : commandes EN_ATTENTE annulées.
      await cancelPendingOrdersForListing(tx, offer.listingId, "listing_vendue", new Date());
    }

    return result;
  });

  revalidatePath("/compte/offres");

  after(async () => {
    const buyerLocale  = offer.buyer.locale  ?? "fr";
    const sellerLocale = offer.seller.locale ?? "fr";
    const tBuyer  = await getTranslations({ locale: buyerLocale,  namespace: "Notifications" });
    const tSeller = await getTranslations({ locale: sellerLocale, namespace: "Notifications" });
    const offersUrl = (l: string) => `${SITE_URL}/${l}/compte/offres`;
    const fmt = (n: number, l: string) => n.toLocaleString(l === "ar" ? "ar-DZ" : "fr-DZ");

    // Lot 271 — courriel + push + notification in-app en un appel (notifyUser) ; l'URL est commune.
    const buyerUrl = `/${buyerLocale}/compte/offres`;
    const buyerLang = buyerLocale === "ar" ? "ar" : "fr";

    if (action === "ACCEPTED") {
      await notifyUser({
        userId: offer.buyerId,
        kind: "OFFER_ACCEPTED",
        url: buyerUrl,
        body: offer.listing.title,
        email: {
          tag: "offre",
          to: offer.buyer.email,
          subject: tBuyer("offerAcceptedSubject", { title: offer.listing.title }),
          html: `<p>${tBuyer("greeting")}</p><p>${tBuyer("offerAcceptedBody", {
            title: escapeHtml(offer.listing.title),
            amount: fmt(offer.amount, buyerLocale),
          })}</p><p><a href="${offersUrl(buyerLocale)}">${tBuyer("offerAcceptedLink")}</a></p>`,
        },
        push: {
          title: tBuyer("pushOfferAcceptedTitle"),
          body: tBuyer("pushOfferAcceptedBody", { title: offer.listing.title }),
          tag: `offer-accepted-${offer.id}`,
          lang: buyerLang,
        },
      });
    } else if (action === "DECLINED") {
      const recipient = offer.status === "COUNTERED" ? "seller" : "buyer";
      if (recipient === "buyer") {
        await notifyUser({
          userId: offer.buyerId,
          kind: "OFFER_DECLINED",
          url: buyerUrl,
          body: offer.listing.title,
          email: {
            tag: "offre",
            to: offer.buyer.email,
            subject: tBuyer("offerDeclinedSubject", { title: offer.listing.title }),
            html: `<p>${tBuyer("greeting")}</p><p>${tBuyer("offerDeclinedBody", {
              title: escapeHtml(offer.listing.title),
              amount: fmt(offer.amount, buyerLocale),
            })}</p><p><a href="${offersUrl(buyerLocale)}">${tBuyer("offerDeclinedLink")}</a></p>`,
          },
          push: {
            title: tBuyer("pushOfferDeclinedTitle"),
            body: tBuyer("pushOfferDeclinedBody", { title: offer.listing.title }),
            tag: `offer-declined-${offer.id}`,
            lang: buyerLang,
          },
        });
      }
      // Si c'est l'acheteur qui refuse une contre-offre, notifier le vendeur
      if (recipient === "seller") {
        await sendEmailBestEffort("offre", {
          to: offer.seller.email,
          subject: tSeller("counterDeclinedSubject", { title: offer.listing.title }),
          html: `<p>${tSeller("greeting")}</p><p>${tSeller("counterDeclinedBody", {
            title: escapeHtml(offer.listing.title),
          })}</p><p><a href="${offersUrl(sellerLocale)}">${tSeller("counterDeclinedLink")}</a></p>`,
        });
      }
    } else if (action === "COUNTERED" && counterAmount) {
      await notifyUser({
        userId: offer.buyerId,
        kind: "OFFER_COUNTERED",
        url: buyerUrl,
        body: offer.listing.title,
        email: {
          tag: "offre",
          to: offer.buyer.email,
          subject: tBuyer("counterOfferSubject", { title: offer.listing.title }),
          html: `<p>${tBuyer("greeting")}</p><p>${tBuyer("counterOfferBody", {
            title: escapeHtml(offer.listing.title),
            amount: fmt(counterAmount, buyerLocale),
          })}</p><p><a href="${offersUrl(buyerLocale)}">${tBuyer("counterOfferLink")}</a></p>`,
        },
        push: {
          title: tBuyer("pushCounterOfferTitle"),
          body: tBuyer("pushCounterOfferBody", { title: offer.listing.title, amount: fmt(counterAmount, buyerLocale) }),
          tag: `offer-countered-${offer.id}`,
          lang: buyerLang,
        },
      });
    }
  });

  return NextResponse.json({ offer: updated });
});

// PUT — acheteur modifie son offre PENDING (montant + message)
export const PUT = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`offer:action:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const offer = await prisma.offer.findUnique({ where: { id }, select: { buyerId: true, status: true } });

  if (!offer || offer.status !== "PENDING") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (offer.buyerId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await parseJsonBody(request, updateOfferSchema);
  if (body instanceof NextResponse) return body;

  const updated = await prisma.offer.update({
    where: { id },
    data:  { amount: body.amount, message: body.message ?? null },
  });

  revalidatePath("/compte/offres");
  return NextResponse.json({ offer: updated });
});
