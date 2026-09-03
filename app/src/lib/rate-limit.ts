// Limiteur de débit en mémoire — suffisant pour une instance unique (MVP).
// À remplacer par un limiteur Redis (cf. docs/ARCHITECTURE.md §06) dès que
// l'application tourne sur plusieurs instances.

const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}
