// Vérification CSRF par l'origine (même approche que le produit SOUQ AUTO).
// Pour toute requête mutante, l'en-tête `Origin` doit correspondre à l'hôte
// servi. En l'absence d'`Origin` sur une requête mutante, on refuse.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isSameOriginRequest(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
