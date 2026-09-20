// Lot 110 — pagination partagée (annuaire des professionnels, essais).
//
// `pageWindow` sert aux listes paginées côté base (skip/take après un count) ;
// `paginate` aux listes déjà chargées en mémoire. Une page demandée au-delà de
// la dernière est ramenée à la dernière plutôt que d'afficher une page vide.
export function pageWindow(totalCount: number, requestedPage: number | undefined, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, requestedPage ?? 1), totalPages);
  return { page, totalPages, skip: (page - 1) * pageSize };
}

export function paginate<T>(items: T[], requestedPage: number | undefined, pageSize: number) {
  const { page, totalPages, skip } = pageWindow(items.length, requestedPage, pageSize);
  return {
    items: items.slice(skip, skip + pageSize),
    page,
    totalPages,
    totalCount: items.length,
  };
}

// Lot 137 — numéro de page lu dans l'adresse (?page=3) par les pages qui paginent leurs annonces (vendeur, vitrine
// professionnelle). Absent, non numérique, négatif ou décimal : `undefined` (pageWindow ramène alors à la page 1) ; plafonné
// pour qu'un « ?page=999999999999 » ne produise jamais un décalage (OFFSET) démesuré côté base.
export const MAX_REQUESTED_PAGE = 100_000;

export function parseRequestedPage(raw: string | string[] | undefined): number | undefined {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!value || !/^\d{1,9}$/.test(value)) return undefined;
  return Math.min(MAX_REQUESTED_PAGE, Number(value));
}
