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
