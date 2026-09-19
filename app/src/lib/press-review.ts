// Lot 114 — revue de presse : liens vers des essais publiés par d'autres médias.
//
// On ne stocke jamais leur texte : seulement l'adresse, le média, le titre tel
// que publié et la date de parution chez lui, plus une phrase écrite par la
// rédaction. Cette adresse n'est jamais téléchargée par le serveur (aucun risque
// de requête vers un réseau interne) ; elle est seulement affichée comme lien.

export const MAX_URL_LENGTH = 500;

// Paramètres de suivi publicitaire : ils ne désignent pas une page différente,
// mais empêcheraient de reconnaître deux fois le même article.
const TRACKING_PARAMS = /^(utm_[a-z0-9_]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|xtor|at_[a-z_]+)$/i;

// Adresse normalisée d'un article externe, ou `null` si elle ne convient pas.
// Refusées : tout schéma autre que https (dont `javascript:` et `data:`), les
// identifiants dans l'adresse (`https://media.fr@autre-site.com/` trompe le
// lecteur sur la destination réelle), les adresses IP et noms sans point
// (`localhost`, réseau interne). Le fragment (`#…`), les paramètres de suivi et
// la barre finale sont retirés : l'unicité en base repose sur cette forme.
export function normalizeSourceUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;

  const host = url.hostname;
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
  if (isIp || !host.includes(".") || host.endsWith(".")) return null;

  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  const normalized = url.toString();
  return normalized.length <= MAX_URL_LENGTH ? normalized : null;
}

// Nom du média affiché tel que la rédaction l'a saisi (« Auto Magazine ») ;
// le domaine de l'adresse sert de repli visible pour le lecteur.
export function hostLabel(normalizedUrl: string): string {
  try {
    return new URL(normalizedUrl).hostname.replace(/^www\./, "");
  } catch {
    return normalizedUrl;
  }
}
