import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkListingPriceEditable, isPriceDrop } from "@/lib/listing-lifecycle";
import { canManageListing } from "@/lib/listing-access";
import { sendEmail, escapeHtml } from "@/lib/mailer";

const bodySchema = z.object({
  price: z.number().int().positive().max(999_999_999),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`update-price-listing:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
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
  if (!(await canManageListing(user.id, listing.sellerId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const eligibility = checkListingPriceEditable(listing.status);
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 400 });
  }

  const oldPrice = listing.price;
  const newPrice = parsed.data.price;

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
    const favorites = await prisma.favorite.findMany({
      where: { listingId: id },
      include: { user: true },
    });

    // Envoyés en parallèle plutôt que séquentiellement (Lot 99, audit
    // qualité) — chaque envoi est déjà indépendant et au mieux (.catch()
    // propre), aucune raison d'attendre l'un avant de commencer le suivant.
    await Promise.all(
      favorites.map(async (favorite) => {
        const t = await getTranslations({ locale: favorite.user.locale, namespace: "Notifications" });
        const emailResult = await sendEmail({
          to: favorite.user.email,
          subject: t("priceDropSubject"),
          html: `<p>${t("greeting")}</p><p>${t("priceDropBody", {
            title: escapeHtml(listing.title),
            oldPrice: oldPrice.toLocaleString(),
            newPrice: newPrice.toLocaleString(),
          })}</p>`,
        }).catch((err) => {
          console.error(`[EMAIL notification baisse de prix] échec envoi: ${(err as Error).message}`);
          return null;
        });
        if (emailResult?.previewUrl) {
          console.log(`[EMAIL notification baisse de prix] ${emailResult.previewUrl}`);
        }
      })
    );
  }

  return NextResponse.json({ price: newPrice });
}
