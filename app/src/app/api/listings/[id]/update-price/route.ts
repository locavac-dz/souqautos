import { NextRequest, NextResponse, after } from "next/server";
import { apiHandler, requireUser, parseJsonBody } from "@/lib/api-route";
import { formatNumber } from "@/lib/format";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkListingPriceEditable, isPriceDrop } from "@/lib/listing-lifecycle";
import { canManageListing } from "@/lib/listing-access";
import { escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";
import { notifyUser } from "@/lib/notify-user";

const bodySchema = z.object({
  price: z.number().int().positive().max(999_999_999),
});

export const POST = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`update-price-listing:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const body = await parseJsonBody(request, bodySchema);
  if (body instanceof NextResponse) return body;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!(await canManageListing(user.id, listing.sellerId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const eligibility = checkListingPriceEditable(listing.status);
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 400 });
  }

  const oldPrice = listing.price;
  const newPrice = body.price;

  // Historique des prix (Lot 45) : une entrée par changement réel — jamais si
  // le vendeur "modifie" pour remettre exactement le même montant.
  await prisma.listing.update({
    where: { id },
    data: {
      price: newPrice,
      ...(newPrice !== oldPrice ? { priceHistory: { create: [{ price: newPrice }] } } : {}),
    },
  });

  // Alerte de baisse de prix aux favoris — comblement du second écart du Lot 5
  // (le premier, l'expiration/renouvellement, a été traité au Lot 22). Envoi
  // au mieux (best effort) : un échec d'email individuel n'annule jamais la
  // mise à jour de prix elle-même, ni les envois aux autres favoris.
  if (isPriceDrop(oldPrice, newPrice)) {
    // Lot 268 (audit C5) — APRÈS la réponse au vendeur et par lots de 20 : une annonce à 500 favoris ouvrait
    // 500 envois SMTP simultanés avant de répondre (et pouvait dépasser la limite d'envoi du fournisseur).
    after(() => notifyFavoritesOfPriceDrop(id, listing.title, oldPrice, newPrice));
  }

  return NextResponse.json({ price: newPrice });
});

const PRICE_DROP_BATCH = 20;

async function notifyFavoritesOfPriceDrop(listingId: string, title: string, oldPrice: number, newPrice: number): Promise<void> {
  const favorites = await prisma.favorite.findMany({
    where: { listingId },
    include: { user: true },
  });

  for (let i = 0; i < favorites.length; i += PRICE_DROP_BATCH) {
    await Promise.all(
      favorites.slice(i, i + PRICE_DROP_BATCH).map(async (favorite) => {
        const locale = favorite.user.locale === "ar" ? "ar" : "fr";
        const t = await getTranslations({ locale, namespace: "Notifications" });
        const price = (p: number) => formatNumber(p, locale);

        await notifyUser({
          userId: favorite.userId,
          kind: "FAVORITE_PRICE_DROP",
          url: `/${locale}/annonce/${listingId}`,
          body: t("priceDropBody", { title, oldPrice: price(oldPrice), newPrice: price(newPrice) }),
          title: t("priceDropInAppTitle"),
          email: {
            tag: "baisse de prix favori",
            to: favorite.user.email,
            subject: t("priceDropSubject"),
            html: `<p>${t("greeting")}</p><p>${t("priceDropBody", {
              title: escapeHtml(title),
              oldPrice: price(oldPrice),
              newPrice: price(newPrice),
            })}</p><p><a href="${SITE_URL}/${locale}/annonce/${listingId}">${t("priceDropLink")}</a></p>`,
          },
          push: {
            title: t("pushPriceDropTitle"),
            body: t("pushPriceDropBody", { title, oldPrice: price(oldPrice), newPrice: price(newPrice) }),
            tag: `pricedrop-${listingId}`,
            lang: locale,
          },
        });
      })
    );
  }
}
