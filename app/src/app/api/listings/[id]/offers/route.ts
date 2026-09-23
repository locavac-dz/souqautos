import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { makeOfferSchema } from "@/lib/validation/offer";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { sendPushToUser } from "@/lib/push-send";
import { SITE_URL } from "@/lib/site";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

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

  const body = await request.json().catch(() => null);
  const parsed = makeOfferSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  const offer = await prisma.offer.create({
    data: {
      listingId,
      buyerId: user.id,
      sellerId: listing.sellerId,
      amount: parsed.data.amount,
      message: parsed.data.message ?? null,
    },
  });

  after(async () => {
    const sellerLocale = listing.seller.locale ?? "fr";
    const t = await getTranslations({ locale: sellerLocale, namespace: "Notifications" });
    const offerUrl = `${SITE_URL}/${sellerLocale}/compte/offres`;

    await sendEmail({
      to: (await prisma.user.findUnique({ where: { id: listing.sellerId }, select: { email: true } }))!.email,
      subject: t("newOfferSubject", { title: listing.title }),
      html: `<p>${t("greeting")}</p><p>${t("newOfferBody", {
        title: escapeHtml(listing.title),
        amount: parsed.data.amount.toLocaleString(sellerLocale === "ar" ? "ar-DZ" : "fr-DZ"),
      })}</p><p><a href="${offerUrl}">${t("newOfferLink")}</a></p>`,
    }).catch(() => null);

    await sendPushToUser(listing.sellerId, {
      title: t("pushNewOfferTitle"),
      body: t("pushNewOfferBody", {
        title: listing.title,
        amount: parsed.data.amount.toLocaleString(sellerLocale === "ar" ? "ar-DZ" : "fr-DZ"),
      }),
      url: `/${sellerLocale}/compte/offres`,
      tag: `offer-${offer.id}`,
      lang: sellerLocale === "ar" ? "ar" : "fr",
    });
  });

  return NextResponse.json({ offer }, { status: 201 });
}
