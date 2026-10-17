// Limiteur de débit en mémoire (fenêtre glissante par clé) — défense en
// profondeur pour les endpoints PUBLICS (ex. portail de dépôt de réclamation).
//
// Limites : la mémoire n'est PAS partagée entre instances/processus ; en
// production, prévoir aussi un WAF / rate-limit en amont (« à valider »). Ici
// c'est une protection anti-abus simple, configurable, et testable (horloge
// injectable).
export interface RateLimiter {
  /** Retourne true si l'action est autorisée (et la comptabilise), false sinon. */
  check(cle: string): boolean;
}

export function createRateLimiter(
  max: number,
  fenetreMs: number,
  now: () => number = Date.now,
): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    check(cle: string): boolean {
      const t = now();
      const recents = (hits.get(cle) ?? []).filter((ts) => t - ts < fenetreMs);
      if (recents.length >= max) {
        hits.set(cle, recents);
        return false;
      }
      recents.push(t);
      hits.set(cle, recents);
      return true;
    },
  };
}
