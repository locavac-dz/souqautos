import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { respondOfferSchema, updateOfferSchema } from "@/lib/validation/offer";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { sendPushToUser } from "@/lib/push-send";
import { SITE_URL } from "@/lib/site";
import { checkRateLimit } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notification-service";

// PATCH — vendeur : accepte / refuse / contre-offre ; acheteur : retire / répond à une contre-offre
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

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

  const body = await request.json().catch(() => null);
  const parsed = respondOfferSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  const { action, counterAmount } = parsed.data;

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

    if (action === "ACCEPTED") {
      await sendEmail({
        to: offer.buyer.email,
        subject: tBuyer("offerAcceptedSubject", { title: offer.listing.title }),
        html: `<p>${tBuyer("greeting")}</p><p>${tBuyer("offerAcceptedBody", {
          title: escapeHtml(offer.listing.title),
          amount: fmt(offer.amount, buyerLocale),
        })}</p><p><a href="${offersUrl(buyerLocale)}">${tBuyer("offerAcceptedLink")}</a></p>`,
      }).catch(() => null);
      await sendPushToUser(offer.buyerId, {
        title: tBuyer("pushOfferAcceptedTitle"),
        body:  tBuyer("pushOfferAcceptedBody", { title: offer.listing.title }),
        url:   `/${buyerLocale}/compte/offres`,
        tag:   `offer-accepted-${offer.id}`,
        lang:  buyerLocale === "ar" ? "ar" : "fr",
      });
      await createNotification(offer.buyerId, "OFFER_ACCEPTED", {
        url: `/${buyerLocale}/compte/offres`,
        body: offer.listing.title,
      });
    } else if (action === "DECLINED") {
      const recipient = offer.status === "COUNTERED" ? "seller" : "buyer";
      if (recipient === "buyer") {
        await sendEmail({
          to: offer.buyer.email,
          subject: tBuyer("offerDeclinedSubject", { title: offer.listing.title }),
          html: `<p>${tBuyer("greeting")}</p><p>${tBuyer("offerDeclinedBody", {
            title: escapeHtml(offer.listing.title),
            amount: fmt(offer.amount, buyerLocale),
          })}</p><p><a href="${offersUrl(buyerLocale)}">${tBuyer("offerDeclinedLink")}</a></p>`,
        }).catch(() => null);
        await sendPushToUser(offer.buyerId, {
          title: tBuyer("pushOfferDeclinedTitle"),
          body:  tBuyer("pushOfferDeclinedBody", { title: offer.listing.title }),
          url:   `/${buyerLocale}/compte/offres`,
          tag:   `offer-declined-${offer.id}`,
          lang:  buyerLocale === "ar" ? "ar" : "fr",
        });
        await createNotification(offer.buyerId, "OFFER_DECLINED", {
          url: `/${buyerLocale}/compte/offres`,
          body: offer.listing.title,
        });
      }
      // Si c'est l'acheteur qui refuse une contre-offre, notifier le vendeur
      if (recipient === "seller") {
        await sendEmail({
          to: offer.seller.email,
          subject: tSeller("counterDeclinedSubject", { title: offer.listing.title }),
          html: `<p>${tSeller("greeting")}</p><p>${tSeller("counterDeclinedBody", {
            title: escapeHtml(offer.listing.title),
          })}</p><p><a href="${offersUrl(sellerLocale)}">${tSeller("counterDeclinedLink")}</a></p>`,
        }).catch(() => null);
      }
    } else if (action === "COUNTERED" && counterAmount) {
      await sendEmail({
        to: offer.buyer.email,
        subject: tBuyer("counterOfferSubject", { title: offer.listing.title }),
        html: `<p>${tBuyer("greeting")}</p><p>${tBuyer("counterOfferBody", {
          title:   escapeHtml(offer.listing.title),
          amount:  fmt(counterAmount, buyerLocale),
        })}</p><p><a href="${offersUrl(buyerLocale)}">${tBuyer("counterOfferLink")}</a></p>`,
      }).catch(() => null);
      await sendPushToUser(offer.buyerId, {
        title: tBuyer("pushCounterOfferTitle"),
        body:  tBuyer("pushCounterOfferBody", { title: offer.listing.title, amount: fmt(counterAmount, buyerLocale) }),
        url:   `/${buyerLocale}/compte/offres`,
        tag:   `offer-countered-${offer.id}`,
        lang:  buyerLocale === "ar" ? "ar" : "fr",
      });
      await createNotification(offer.buyerId, "OFFER_COUNTERED", {
        url: `/${buyerLocale}/compte/offres`,
        body: offer.listing.title,
      });
    }
  });

  return NextResponse.json({ offer: updated });
}

// PUT — acheteur modifie son offre PENDING (montant + message)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

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

  const body = await request.json().catch(() => null);
  const parsed = updateOfferSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  const updated = await prisma.offer.update({
    where: { id },
    data:  { amount: parsed.data.amount, message: parsed.data.message ?? null },
  });

  revalidatePath("/compte/offres");
  return NextResponse.json({ offer: updated });
}
