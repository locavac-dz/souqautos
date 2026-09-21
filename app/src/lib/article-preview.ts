import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { articleStatus } from "@/lib/blog-publication";

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

export type ArticlePreview = {
  status: "draft" | "scheduled";
  // La date de parution prévue, pour un contenu programmé ; `null` pour un brouillon.
  scheduledFor: Date | null;
};

// Décision pure : que voit CE visiteur d'un contenu à l'état `publishedAt` ? `null` = rien (404) ou, pour un contenu paru, pas d'aperçu.
export function previewFor(publishedAt: Date | null, now: Date, viewerIsAdmin: boolean): ArticlePreview | null {
  const status = articleStatus(publishedAt, now);
  if (status === "published" || !viewerIsAdmin) return null;
  return { status, scheduledFor: status === "scheduled" ? publishedAt : null };
}

export async function resolveArticleForViewer<T extends { publishedAt: Date | null }>(
  findPublished: () => Promise<T | null>,
  findAnyState: () => Promise<T | null>,
): Promise<{ article: T; preview: ArticlePreview | null } | null> {
  const published = await findPublished();
  if (published) return { article: published, preview: null };

  const candidate = await findAnyState();
  if (!candidate) return null;
  const now = new Date();
  if (articleStatus(candidate.publishedAt, now) === "published") return null; // paru, mais masqué pour une autre raison

  const user = await getCurrentUser();
  const preview = previewFor(candidate.publishedAt, now, Boolean(user && isAdmin(user.role)));
  return preview ? { article: candidate, preview } : null;
}
