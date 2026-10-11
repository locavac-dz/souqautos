import { NextRequest, NextResponse } from "next/server";
import { apiHandler, parseJsonBody, NO_STORE } from "@/lib/api-route";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";
import { SITE_URL } from "@/lib/site";
import { CONTACT_LOCALES, buildTelUrl, buildWhatsappMessage, buildWhatsappUrl } from "@/lib/contact-links";

// Lot 119 — révélation du numéro du vendeur, À LA DEMANDE.
//
// Avant ce lot, la page d'une annonce passait `seller.phone` à un composant client.
// Lu depuis l'annonce, ce champ reste CHIFFRÉ (l'extension de déchiffrement ne
// s'applique qu'aux requêtes directes sur `user`) : chaque visiteur recevait donc le
// numéro chiffré (lisible seulement avec la clé, mais identique pour un même numéro,
// donc traçable d'une annonce à l'autre) et le bouton « Afficher le numéro » affichait ce
// texte illisible au lieu d'un numéro — personne ne l'avait vu, aucun vendeur de
// démonstration n'ayant de téléphone. Le numéro n'est plus dans la page : il est
// demandé ici, au clic, avec des limites de débit, et chaque révélation est comptée.
//
// Ouvert aux visiteurs non connectés (comme sur les autres sites d'annonces
// algériens), mais limité : par adresse, par annonce et par adresse, et davantage
// pour un compte connecté.
const bodySchema = z.object({
  channel: z.enum(["TELEPHONE", "WHATSAPP"]),
  locale: z.enum(CONTACT_LOCALES).default("fr"),
});

export const POST = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const body = await parseJsonBody(request, bodySchema, { headers: NO_STORE });
  if (body instanceof NextResponse) return body;
  const { channel, locale } = body;

  const { id } = await params;
  const viewer = await getCurrentUser();

  const limits = viewer
    ? [[`contact-user:${viewer.id}`, { limit: 100, windowMs: 60 * 60 * 1000 }] as const]
    : [
        [`contact-ip:${getClientIp(request)}`, { limit: 30, windowMs: 60 * 60 * 1000 }] as const,
        [`contact-ip-listing:${getClientIp(request)}:${id}`, { limit: 6, windowMs: 60 * 60 * 1000 }] as const,
      ];
  for (const [key, limit] of limits) {
    if (!(await checkRateLimit(key, limit))) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
    }
  }

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      sellerId: true,
      seller: { select: { whatsappEnabled: true, suspendedAt: true, deletedAt: true } },
    },
  });

  // Une annonce non publiée, un vendeur suspendu ou supprimé, ou un vendeur sans
  // numéro : même réponse (404), sans rien révéler de la raison.
  if (!listing || listing.status !== "PUBLIEE" || listing.seller.suspendedAt || listing.seller.deletedAt) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }
  if (viewer?.id === listing.sellerId) {
    return NextResponse.json({ error: "own_listing" }, { status: 400, headers: NO_STORE });
  }
  if (channel === "WHATSAPP" && !listing.seller.whatsappEnabled) {
    return NextResponse.json({ error: "whatsapp_unavailable" }, { status: 404, headers: NO_STORE });
  }

  // Un vendeur qui a bloqué ce compte ne lui livre pas son numéro (même règle que la messagerie).
  if (viewer) {
    const blocked = await prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: listing.sellerId, blockedId: viewer.id } },
      select: { blockerId: true },
    });
    if (blocked) {
      return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
    }
  }

  // Le numéro est chiffré au repos : seule une lecture DIRECTE du modèle `user` le
  // déchiffre (extension de src/lib/prisma.ts). Lu depuis l'annonce (select ou include
  // imbriqué), il reste chiffré — c'est ce qui rendait l'ancien bouton inutilisable.
  const sellerRecord = await prisma.user.findUnique({ where: { id: listing.sellerId }, select: { phone: true } });
  const phone = sellerRecord?.phone;
  if (!phone) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }
  const telUrl = buildTelUrl(phone);
  const whatsappUrl =
    channel === "WHATSAPP"
      ? buildWhatsappUrl(phone, buildWhatsappMessage({ title: listing.title, url: `${SITE_URL}/${locale}/annonce/${listing.id}`, locale }))
      : null;
  if (!telUrl || (channel === "WHATSAPP" && !whatsappUrl)) {
    // Numéro enregistré dans un format inattendu : jamais un lien cassé.
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }

  await prisma.contactEvent.create({
    data: { listingId: listing.id, channel, userId: viewer?.id ?? null },
  });

  return NextResponse.json(
    channel === "WHATSAPP" ? { channel, whatsappUrl } : { channel, phone, telUrl },
    { headers: NO_STORE }
  );
});
