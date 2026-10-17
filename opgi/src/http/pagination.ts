// Analyse des paramètres de pagination et de recherche, communs aux listes.
// Pagination OPT-IN : sans `page` ni `perPage`, aucune limite n'est appliquée
// (comportement historique préservé). `q` est un filtre texte facultatif.
export interface PageParams {
  q?: string;
  skip?: number;
  take?: number;
  paginated: boolean;
  page: number;
  perPage: number;
}

export function parseListParams(url: string): PageParams {
  const sp = new URL(url).searchParams;
  const q = sp.get("q")?.trim() || undefined;
  const paginated = sp.has("page") || sp.has("perPage");

  const perPageRaw = Number(sp.get("perPage") ?? "20");
  const perPage = Number.isFinite(perPageRaw) ? Math.min(Math.max(Math.trunc(perPageRaw), 1), 100) : 20;
  const pageRaw = Number(sp.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) ? Math.max(Math.trunc(pageRaw), 1) : 1;

  return {
    q,
    paginated,
    page,
    perPage,
    skip: paginated ? (page - 1) * perPage : undefined,
    take: paginated ? perPage : undefined,
  };
}

/** En-têtes de pagination à joindre à la réponse de liste. */
export function pageHeaders(total: number, p: PageParams): Record<string, string> {
  const h: Record<string, string> = { "x-total-count": String(total) };
  if (p.paginated) {
    h["x-page"] = String(p.page);
    h["x-per-page"] = String(p.perPage);
  }
  return h;
}
