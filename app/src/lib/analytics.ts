import { z } from "zod";

// Lot 124 — mesure d'audience sans cookie ni identifiant : logique pure, testée sans base.
//
// Principe : on ne garde que des COMPTEURS par jour, par modèle de page, par langue, par type
// d'appareil et par catégorie de provenance. Rien qui permette de reconnaître un visiteur.

export type AudienceLocale = "fr" | "ar";

// Modèles d'adresse comptés (sans la langue). Toute autre adresse — espace personnel, publication,
// administration, jetons de confirmation, adresse inconnue — n'est jamais comptée : ni envoyée par
// le navigateur, ni acceptée par le serveur. Le jeu est FERMÉ, ce qui borne le nombre de lignes.
export const PUBLIC_PAGES = [
  "/",
  "/recherche",
  "/annonce/[id]",
  "/voitures",
  "/voitures/[marque]",
  "/voitures/[marque]/[modele]",
  "/wilaya",
  "/wilaya/[wilaya]",
  "/mag",
  "/mag/[slug]",
  "/essais",
  "/essais/[slug]",
  "/guides",
  "/guides/[slug]",
  "/cote-souq-auto",
  "/comparateur",
  "/professionnels",
  "/concessionnaires",
  "/devenir-professionnel",
  "/pro/[id]",
  "/vendeur/[id]",
  "/vendre",
  "/connexion",
  "/inscription",
  "/mentions-legales",
  "/politique-confidentialite",
  "/conditions-generales",
] as const;
export type PublicPage = (typeof PUBLIC_PAGES)[number];

// Sous-adresses de /pro qui sont l'outil du compte professionnel, pas une vitrine publique.
const PRO_TOOL_SEGMENTS = new Set(["tableau-de-bord", "import", "statistiques", "prospects"]);

// Pages dont le dernier segment est un identifiant public de CONTENU (et non un numéro d'annonce ou
// de vendeur) : leur détail est gardé pour savoir quels articles, marques et modèles sont lus.
const DETAIL_PAGES: ReadonlySet<PublicPage> = new Set(["/mag/[slug]", "/essais/[slug]", "/guides/[slug]", "/voitures/[marque]", "/voitures/[marque]/[modele]", "/wilaya/[wilaya]"]);

const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

export type ClassifiedPath = { locale: AudienceLocale; page: PublicPage; detail: string };

const SINGLE_SEGMENT_PAGES: Record<string, PublicPage> = {
  recherche: "/recherche",
  voitures: "/voitures",
  wilaya: "/wilaya",
  mag: "/mag",
  essais: "/essais",
  guides: "/guides",
  "cote-souq-auto": "/cote-souq-auto",
  comparateur: "/comparateur",
  professionnels: "/professionnels",
  concessionnaires: "/concessionnaires",
  "devenir-professionnel": "/devenir-professionnel",
  vendre: "/vendre",
  connexion: "/connexion",
  inscription: "/inscription",
  "mentions-legales": "/mentions-legales",
  "politique-confidentialite": "/politique-confidentialite",
  "conditions-generales": "/conditions-generales",
};

// Modèle de page d'après les segments SANS la langue, et détail brut (avant validation).
function matchPage(segments: string[]): { page: PublicPage; detail: string } | null {
  const [a, b, c] = segments;
  switch (segments.length) {
    case 0:
      return { page: "/", detail: "" };
    case 1:
      return Object.hasOwn(SINGLE_SEGMENT_PAGES, a) ? { page: SINGLE_SEGMENT_PAGES[a], detail: "" } : null;
    case 2:
      if (a === "annonce") return { page: "/annonce/[id]", detail: "" };
      if (a === "vendeur") return { page: "/vendeur/[id]", detail: "" };
      if (a === "pro") return PRO_TOOL_SEGMENTS.has(b) ? null : { page: "/pro/[id]", detail: "" };
      if (a === "mag") return { page: "/mag/[slug]", detail: b };
      if (a === "essais") return { page: "/essais/[slug]", detail: b };
      if (a === "guides") return { page: "/guides/[slug]", detail: b };
      if (a === "voitures") return { page: "/voitures/[marque]", detail: b };
      if (a === "wilaya") return { page: "/wilaya/[wilaya]", detail: b };
      return null;
    case 3:
      return a === "voitures" ? { page: "/voitures/[marque]/[modele]", detail: `${b}/${c}` } : null;
    default:
      return null;
  }
}

// Décompose une adresse (chemin seul : la requête `?…` et l'ancre `#…` sont écartées sans être lues,
// elles peuvent contenir des recherches ou des jetons). `null` si la page n'est pas comptée.
export function classifyPublicPath(rawPath: string): ClassifiedPath | null {
  if (typeof rawPath !== "string" || rawPath.length === 0 || rawPath.length > 300) return null;
  const pathname = rawPath.split(/[?#]/, 1)[0];
  if (!pathname.startsWith("/")) return null;

  const segments = pathname.split("/").filter((segment) => segment !== "");
  const locale = segments.shift();
  if (locale !== "fr" && locale !== "ar") return null;

  const decoded: string[] = [];
  for (const segment of segments) {
    try {
      decoded.push(decodeURIComponent(segment));
    } catch {
      return null; // encodage invalide
    }
  }
  if (decoded.some((segment) => segment.includes("/") || segment.includes("\\"))) return null; // %2F déguisé

  const match = matchPage(decoded);
  if (match === null) return null;

  if (!DETAIL_PAGES.has(match.page)) return { locale, page: match.page, detail: "" };
  // Un détail n'est gardé que s'il a la forme d'un identifiant public : pas de texte libre.
  if (!match.detail.split("/").every((part) => SLUG.test(part))) return null;
  return { locale, page: match.page, detail: match.detail };
}

// --- Provenance --------------------------------------------------------------------------------------------------

export const REFERRER_CATEGORIES = ["direct", "interne", "recherche", "reseaux", "autre"] as const;
export type ReferrerCategory = (typeof REFERRER_CATEGORIES)[number];

// Comparés aux SEGMENTS du nom de domaine (google.dz, google.com…), jamais à une sous-chaîne : « t.co »
// ne doit pas reconnaître « content.com ». Une application Android renvoie un nom de paquet
// (com.google.android.googlequicksearchbox) : ses segments sont comparés de la même façon.
const SEARCH_ENGINES = new Set(["google", "bing", "yahoo", "duckduckgo", "ecosia", "yandex", "qwant", "baidu", "startpage", "brave"]);
const SOCIAL_NETWORKS = new Set(["facebook", "fb", "instagram", "twitter", "x", "t", "tiktok", "youtube", "youtu", "linkedin", "whatsapp", "wa", "telegram", "snapchat", "pinterest", "reddit"]);

// Catégorie seulement : le site de provenance n'est JAMAIS gardé (ni son adresse, ni son nom).
export function classifyReferrer(referrer: string | undefined | null, ownHost: string): ReferrerCategory {
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "direct";
  }
  const own = ownHost.toLowerCase().split(":")[0];
  if (host === own || host.endsWith(`.${own}`)) return "interne";
  const labels = host.split(".");
  if (labels.some((label) => SEARCH_ENGINES.has(label))) return "recherche";
  if (labels.some((label) => SOCIAL_NETWORKS.has(label))) return "reseaux";
  return "autre";
}

// --- Appareil ----------------------------------------------------------------------------------------------------

export const DEVICE_CLASSES = ["mobile", "tablette", "ordinateur"] as const;
export type DeviceClass = (typeof DEVICE_CLASSES)[number];

// Le User-Agent sert UNIQUEMENT à choisir une de ces trois classes, puis il est jeté.
export function classifyDevice(userAgent: string | null | undefined): DeviceClass {
  const ua = userAgent ?? "";
  if (/ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return "tablette";
  if (/mobi|iphone|ipod|android|windows phone|blackberry|opera mini/i.test(ua)) return "mobile";
  return "ordinateur";
}

// --- Corps de la requête du navigateur -----------------------------------------------------------------------------

export const MAX_BEACON_BYTES = 1000;

export const beaconSchema = z.object({
  path: z.string().min(1).max(300),
  referrer: z.string().max(500).optional(),
});
export type Beacon = z.infer<typeof beaconSchema>;

// Le navigateur envoie du JSON ; on lit du texte (les balises d'envoi peuvent déclarer n'importe
// quel type) avec une taille bornée. `null` pour tout ce qui n'est pas un corps valide.
export function parseBeacon(text: string): Beacon | null {
  if (text.length === 0 || text.length > MAX_BEACON_BYTES) return null;
  try {
    const parsed = beaconSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Respect du signal « Ne pas me suivre » (DNT) et du Global Privacy Control : même sans aucune donnée
// personnelle, ceux qui l'ont activé ne sont pas comptés. Vaut côté navigateur ET côté serveur.
export function isTrackingOptOut(headers: { get(name: string): string | null }): boolean {
  return headers.get("dnt") === "1" || headers.get("sec-gpc") === "1";
}

// Conservation : 25 mois au plus, durée maximale recommandée pour une mesure d'audience exemptée de consentement.
export const RETENTION_DAYS = 760;
