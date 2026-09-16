// Verrouillage de connexion après échecs répétés (Lot 102, audit sécurité
// Lot 98) — complète le rate limit par IP déjà en place (src/lib/rate-limit.ts,
// contournable via un X-Forwarded-For usurpé) par un compteur par compte,
// qui reste efficace même depuis des IP tournantes. Logique pure extraite de
// la route pour rester testable sans base de données, même discipline que
// checkCanSuspendUser (src/lib/user-suspension.ts).
export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export function isAccountLocked(lockedUntil: Date | null, now: Date): boolean {
  return Boolean(lockedUntil && lockedUntil > now);
}

// Appelé après un mot de passe erroné sur un compte non verrouillé —
// incrémente le compteur et pose un verrouillage seulement au seuil atteint.
export function computeFailedLoginUpdate(
  currentAttempts: number,
  now: Date
): { failedLoginAttempts: number; lockedUntil: Date | null } {
  const attempts = currentAttempts + 1;
  return {
    failedLoginAttempts: attempts,
    lockedUntil: attempts >= LOCKOUT_THRESHOLD ? new Date(now.getTime() + LOCKOUT_DURATION_MS) : null,
  };
}
