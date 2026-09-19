// Verrouillage de connexion après échecs répétés (Lot 102, audit sécurité
// Lot 98) — complète le rate limit par IP déjà en place (src/lib/rate-limit.ts,
// contournable via un X-Forwarded-For usurpé) par un compteur par compte,
// qui reste efficace même depuis des IP tournantes. Logique pure extraite de
// la route pour rester testable sans base de données, même discipline que
// checkCanSuspendUser (src/lib/user-suspension.ts).
export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// Nombre maximal de tentatives de connexion (bonnes ou mauvaises) traitées par
// compte et par fenêtre, quelle que soit l'adresse d'où elles viennent. Le
// compteur d'échecs ne voit une tentative qu'une fois son mot de passe vérifié :
// des tentatives envoyées toutes en même temps sont donc toutes vérifiées avant
// que le verrouillage n'existe. Ce plafond, contrôlé avant toute vérification,
// borne cette rafale (Lot 112).
export const LOGIN_ACCOUNT_LIMIT = { limit: 20, windowMs: 15 * 60 * 1000 };

export function isAccountLocked(lockedUntil: Date | null, now: Date): boolean {
  return Boolean(lockedUntil && lockedUntil > now);
}

// `attempts` est la valeur du compteur APRÈS l'incrément atomique fait par la
// base : le verrouillage se décide sur ce que la base a réellement compté, pas
// sur une valeur lue plus tôt (deux échecs simultanés lisaient la même valeur et
// n'en comptaient qu'un, si bien que des rafales de mots de passe ne
// verrouillaient jamais le compte). Au-delà du seuil, chaque échec prolonge le
// verrouillage.
export function lockedUntilForAttempts(attempts: number, now: Date): Date | null {
  return attempts >= LOCKOUT_THRESHOLD ? new Date(now.getTime() + LOCKOUT_DURATION_MS) : null;
}
