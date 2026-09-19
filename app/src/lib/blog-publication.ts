// Lot 110 — publication programmée du magazine et des essais.
//
// `publishedAt` porte à la fois l'état et la date : null = brouillon, date
// future = programmé, date passée = publié. Avant ce lot le code testait
// seulement « non null », si bien qu'une date future serait apparue tout de
// suite. Toutes les lectures publiques passent maintenant par `publishedNow`.

export type ArticleStatus = "draft" | "scheduled" | "published";

// Fragment de filtre Prisma : `lte` n'égale jamais null, donc les brouillons
// sont aussi exclus.
export function publishedNow(now: Date) {
  return { publishedAt: { lte: now } };
}

export function articleStatus(publishedAt: Date | null, now: Date): ArticleStatus {
  if (!publishedAt) return "draft";
  return publishedAt.getTime() <= now.getTime() ? "published" : "scheduled";
}

// « Mis à jour le… » n'est affiché que si l'écart avec la publication dépasse
// 24 h : une retouche faite juste après la parution ne doit pas signaler une
// mise à jour au lecteur.
const UPDATED_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export function shouldShowUpdatedDate(publishedAt: Date | null, updatedAt: Date): boolean {
  if (!publishedAt) return false;
  return updatedAt.getTime() - publishedAt.getTime() >= UPDATED_THRESHOLD_MS;
}

export type PublicationChoice =
  | { mode: "draft" }
  | { mode: "now" }
  | { mode: "scheduled"; at: string };

// La date est décidée côté serveur (jamais l'horloge du navigateur de l'admin).
// « Publié » sur un article déjà paru conserve sa date d'origine : une simple
// correction ne le republie pas et ne change pas son rang dans la liste.
export function resolvePublishedAt(
  choice: PublicationChoice,
  existing: Date | null,
  now: Date
): Date | null {
  switch (choice.mode) {
    case "draft":
      return null;
    case "now":
      return existing && existing.getTime() <= now.getTime() ? existing : now;
    case "scheduled":
      return new Date(choice.at);
  }
}
