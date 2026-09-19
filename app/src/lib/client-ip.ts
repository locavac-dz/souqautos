// Lot 117 — adresse IP du client, pour les limites de débit par IP.
//
// L'en-tête X-Forwarded-For est une liste « client, mandataire 1, mandataire 2 » :
// chaque serveur intermédiaire y AJOUTE, à droite, l'adresse de celui qui lui a
// parlé. Tout ce qui se trouve à GAUCHE de ce que les serveurs de confiance ont
// ajouté est écrit par le client lui-même et peut être falsifié. Prendre la
// première valeur (comportement d'avant ce lot) permet donc de contourner toutes
// les limites « par IP » en changeant simplement l'en-tête.
//
// TRUSTED_PROXY_HOPS = nombre de serveurs intermédiaires de confiance placés
// devant l'application (1 pour un seul nginx ou un seul répartiteur de charge,
// 2 pour un CDN puis nginx…). L'adresse retenue est celle que le PREMIER de ces
// serveurs a vue, soit la valeur située `hops` rangs avant la fin de la liste.
// Non défini : ancien comportement (première valeur), signalé comme risque par
// `npm run launch:check`.

export const DEFAULT_CLIENT_IP = "local";
export const MAX_TRUSTED_PROXY_HOPS = 5;

// Valeur entière de 1 à 5, ou `null` si la variable est absente ou invalide.
export function parseTrustedProxyHops(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw.trim())) return null;
  const hops = Number(raw.trim());
  return hops >= 1 && hops <= MAX_TRUSTED_PROXY_HOPS ? hops : null;
}

export function pickClientIp(forwardedFor: string | null | undefined, hops: number | null): string {
  const parts = (forwardedFor ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return DEFAULT_CLIENT_IP;

  if (hops === null) return parts[0];

  // Moins d'adresses que de serveurs de confiance : la requête n'est pas passée
  // par toute la chaîne attendue. On prend l'adresse la plus à droite (la plus
  // proche de nous, donc la moins falsifiable) plutôt que de faire confiance à la
  // première.
  const index = parts.length - hops;
  return index >= 0 ? parts[index] : parts[parts.length - 1];
}
