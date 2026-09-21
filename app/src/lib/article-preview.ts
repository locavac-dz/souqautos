import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { articleStatus } from "@/lib/blog-publication";
import { findUsablePreviewLink } from "@/lib/article-preview-links";

// Lot 145 — l'APERÇU d'un contenu non publié, réservé aux administrateurs.
//
// Un brouillon ou un contenu programmé répond 404 au public (Lots 110 et 126) : c'est voulu. Mais l'équipe ne pouvait donc jamais le
// voir MIS EN PAGE avant de le publier — relire un texte long (un guide, un essai) dans un formulaire n'est pas le relire tel que
// le lira le visiteur. L'aperçu montre le contenu à son adresse publique, avec un bandeau, à un ADMINISTRATEUR connecté seulement.
//
// Ce qui le rend sûr, et peu coûteux :
//  - Le chemin public est INCHANGÉ : un contenu paru se sert exactement comme avant, sans aucun appel d'authentification. On ne
//    regarde qui est le visiteur QUE lorsque la page répondrait 404, c'est-à-dire pour un contenu non paru.
//  - Tout autre visiteur (anonyme, membre, modérateur) reçoit le même 404 qu'avant : rien ne distingue « n'existe pas » de « existe en
//    brouillon », ni dans la réponse ni dans son contenu.
//  - Le droit est celui d'ÉDITER ces contenus : administrateur seulement (comme l'administration du magazine, des essais et des guides),
//    et le rôle est le rôle EFFECTIF — un administrateur d'équipe sans double authentification (Lot 138) n'a pas ce droit.
//  - Un contenu DÉJÀ paru mais masqué pour une autre raison (fiche de guide ou d'essai manquante) n'est jamais montré en aperçu.
//
// Lot 146 — un LIEN DE RELECTURE valide (src/lib/article-preview-links.ts) ouvre lui aussi l'aperçu, pour un relecteur sans compte : le
// jeton est lié à CE contenu, à durée limitée, révocable ; il donne la lecture seule (aucun lien « Modifier », aucune session). Un jeton
// invalide, expiré, révoqué ou d'un autre contenu ne change rien : on retombe sur la règle ci-dessus, donc sur le même 404.

export type ArticlePreview = {
  status: "draft" | "scheduled";
  // La date de parution prévue, pour un contenu programmé ; `null` pour un brouillon.
  scheduledFor: Date | null;
  // Présent SEULEMENT quand l'aperçu vient d'un lien de relecture (et non d'un compte administrateur) : jusqu'à quand il vaut.
  reviewLink?: { expiresAt: Date };
};

// Décision pure : que voit CE visiteur d'un contenu à l'état `publishedAt` ? `null` = rien (404) ou, pour un contenu paru, pas d'aperçu.
export function previewFor(publishedAt: Date | null, now: Date, viewerIsAdmin: boolean): ArticlePreview | null {
  const status = articleStatus(publishedAt, now);
  if (status === "published" || !viewerIsAdmin) return null;
  return { status, scheduledFor: status === "scheduled" ? publishedAt : null };
}

// Le jeton d'un lien de relecture, tel qu'il figure dans l'adresse (?apercu=…). Une valeur répétée (?apercu=a&apercu=b) ne garde que la
// première ; la FORME du jeton est vérifiée plus loin, avant toute lecture en base.
export function previewTokenFrom(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" && first !== "" ? first : null;
}

export async function resolveArticleForViewer<T extends { id: string; publishedAt: Date | null }>(
  findPublished: () => Promise<T | null>,
  findAnyState: () => Promise<T | null>,
  options: { previewToken?: string | null } = {},
): Promise<{ article: T; preview: ArticlePreview | null } | null> {
  const published = await findPublished();
  if (published) return { article: published, preview: null };

  const candidate = await findAnyState();
  if (!candidate) return null;
  const now = new Date();
  if (articleStatus(candidate.publishedAt, now) === "published") return null; // paru, mais masqué pour une autre raison

  // Un lien de relecture valide POUR CE CONTENU ouvre l'aperçu, sans compte (Lot 146).
  if (options.previewToken) {
    const link = await findUsablePreviewLink(options.previewToken, candidate.id, now);
    const reviewPreview = link ? previewFor(candidate.publishedAt, now, true) : null;
    if (link && reviewPreview) return { article: candidate, preview: { ...reviewPreview, reviewLink: { expiresAt: link.expiresAt } } };
  }

  const user = await getCurrentUser();
  const preview = previewFor(candidate.publishedAt, now, Boolean(user && isAdmin(user.role)));
  return preview ? { article: candidate, preview } : null;
}
