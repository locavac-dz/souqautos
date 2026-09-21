import { prisma } from "@/lib/prisma";
import { buildShareCard } from "@/lib/share-image";
import { SHARE_HEIGHT, SHARE_WIDTH, loadSharePhoto } from "@/lib/share-image-photo";
import { getShareImage } from "@/lib/share-image-render";
import { resolveListingLabels } from "@/lib/site";

// Lot 142 — l'image qui s'affiche quand le lien d'une annonce est collé dans WhatsApp, Facebook, Messenger…
// Convention Next : ce fichier fait ajouter automatiquement les balises og:image (+ largeur, hauteur, type) à la fiche de l'annonce.
//
// Uniquement pour les annonces PUBLIÉES, exactement comme la fiche elle-même : un brouillon, une annonce refusée ou suspendue ne
// doit fuiter ni son prix ni sa photo par une adresse d'image devinée.
export const alt = "Annonce Souq Auto : photo, prix et caractéristiques du véhicule";
export const size = { width: SHARE_WIDTH, height: SHARE_HEIGHT };
export const contentType = "image/jpeg";

// Assez court pour qu'une baisse de prix ne reste pas affichée longtemps sur une carte périmée (un aperçu qui contredit la fiche
// abîme la confiance) ; assez long pour qu'un lien très partagé ne fasse pas redessiner la carte à chaque visite.
const CACHE_CONTROL = "public, max-age=300, s-maxage=600, stale-while-revalidate=3600";

export default async function Image({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id, locale } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      status: true,
      price: true,
      year: true,
      mileage: true,
      fuelType: true,
      brandFreeText: true,
      modelFreeText: true,
      brand: { select: { name: true } },
      model: { select: { name: true } },
      wilaya: { select: { nomFr: true, nomAr: true } },
      photos: { orderBy: { position: "asc" }, take: 1, select: { path: true } },
    },
  });
  if (!listing || listing.status !== "PUBLIEE") return new Response("Not found", { status: 404 });

  // La carte est la même pour toutes les langues (cf. src/lib/share-image.ts) : le nom de wilaya est toujours le français.
  const { brandLabel, modelLabel } = resolveListingLabels(listing, locale);
  const card = buildShareCard({
    brandLabel,
    modelLabel,
    year: listing.year,
    mileage: listing.mileage,
    fuelType: listing.fuelType,
    price: listing.price,
    wilayaNameFr: listing.wilaya.nomFr,
  });
  const photoPath = listing.photos[0]?.path ?? null;

  const image = await getShareImage(card, photoPath ?? "", () => loadSharePhoto(photoPath));
  return new Response(new Uint8Array(image), { headers: { "Content-Type": contentType, "Cache-Control": CACHE_CONTROL } });
}
