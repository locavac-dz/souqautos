import { e2eDb } from "./db";

// Les pages publiques du site, partagées par les tests qui les parcourent toutes (public-pages.spec.ts : réponse, langue,
// débordement ; accessibility.spec.ts : accessibilité). Une seule liste, pour qu'une page ajoutée soit vérifiée partout.
export const STATIC_PATHS = [
  "",
  "/recherche",
  "/voitures",
  "/cote-souq-auto",
  "/concessionnaires",
  "/professionnels",
  "/devenir-professionnel",
  "/vendre",
  "/comparateur",
  "/mag",
  "/essais",
  "/essais/revue-de-presse",
  "/guides",
  "/wilaya",
  "/conditions-generales",
  "/politique-confidentialite",
  "/mentions-legales",
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
];

// Les écrans de l'administration (réservés à l'équipe), parcourus par admin.spec.ts et accessibility.spec.ts.
export const ADMIN_PAGES = [
  "/admin",
  "/admin/annonces",
  "/admin/utilisateurs",
  "/admin/signalements",
  "/admin/avis",
  "/admin/avis-proprietaires",
  "/admin/pro",
  "/admin/identite",
  "/admin/referentiels",
  "/admin/statistiques",
  "/admin/audience",
  "/admin/parametres",
  "/admin/journal",
  "/admin/paiements",
  "/admin/mag",
  "/admin/mag/nouveau",
  "/admin/essais",
  "/admin/essais/nouveau",
  "/admin/guides",
  "/admin/guides/nouveau",
  "/admin/editorial",
  "/admin/revue-de-presse",
  "/admin/revue-de-presse/nouveau",
];

// Les écrans d'un compte ordinaire connecté (hors annonce précise) ; l'assistant de publication compte 11 étapes.
export const MEMBER_PAGES = [
  "/compte/tableau-de-bord",
  "/compte/mes-annonces",
  "/compte/favoris",
  "/compte/alertes",
  "/compte/messages",
  "/compte/profil",
  "/compte/securite",
  "/compte/assistant-achat",
  ...Array.from({ length: 11 }, (_, index) => `/publier/etape-${index + 1}`),
];

export async function dynamicPaths(): Promise<string[]> {
  const db = e2eDb();
  const listing = await db.listing.findFirstOrThrow({ where: { status: "PUBLIEE" }, select: { id: true, sellerId: true } });
  const wilaya = await db.wilaya.findFirstOrThrow({ select: { slug: true } });
  return [
    "/voitures/renault",
    "/voitures/renault/clio",
    "/voitures/yamaha",
    "/voitures/yamaha/mt-07",
    `/wilaya/${wilaya.slug}`,
    `/annonce/${listing.id}`,
    `/vendeur/${listing.sellerId}`,
  ];
}
