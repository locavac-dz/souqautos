import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";

// Vraie réponse 404 AVANT le flux (lots 131 et 269). `loading.tsx` fait diffuser la page tout de suite : l'en-tête
// 200 part avant que la page lise la base, et un `notFound()` levé ensuite ne peut plus changer le statut (un
// « soft 404 » : page introuvable servie en 200). Un layout, lui, se rend AU-DESSUS de la frontière de `loading.tsx` :
// l'existence et la visibilité de l'annonce sont donc vérifiées ici, avant le premier octet, et le squelette reste.
// Même règle que la page (annonce publiée, ou annonce de son auteur) ; la page la garde aussi, par prudence.
// `getCurrentUser` est mémoïsé par requête : aucune lecture de session supplémentaire.
export default async function AnnonceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [listing, currentUser] = await Promise.all([
    prisma.listing.findUnique({ where: { id }, select: { status: true, sellerId: true } }),
    getCurrentUser(),
  ]);
  if (!listing || (listing.status !== "PUBLIEE" && listing.sellerId !== currentUser?.id)) notFound();

  return children;
}
