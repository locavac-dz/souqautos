// Lot 117 — compte administrateur créé par `npm run db:seed`.
//
// Avant ce lot, le seed créait TOUJOURS `admin@souqautos.com` avec le mot de passe
// de développement écrit en clair dans le dépôt (README, code source) : lancé sur
// une base de production, il y aurait laissé une porte d'entrée administrateur
// que tout lecteur du dépôt connaît. En production, l'adresse et le mot de passe
// doivent maintenant être fournis (ADMIN_EMAIL, ADMIN_PASSWORD), et le mot de
// passe de développement est refusé.

export const DEV_ADMIN_EMAIL = "admin@souqautos.com";
export const DEV_ADMIN_PASSWORD = "AdminSouqAuto2026!";
export const MIN_PRODUCTION_PASSWORD_LENGTH = 12;

type Env = Record<string, string | undefined>;

export type AdminBootstrap =
  | { ok: true; email: string; password: string; usesDevDefaults: boolean }
  | { ok: false; error: string };

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function resolveAdminBootstrap(env: Env): AdminBootstrap {
  const production = env.NODE_ENV === "production";
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;

  if (!production) {
    // Développement et tests : valeurs du README sauf si l'on en fournit d'autres.
    return {
      ok: true,
      email: email || DEV_ADMIN_EMAIL,
      password: password || DEV_ADMIN_PASSWORD,
      usesDevDefaults: !email && !password,
    };
  }

  if (!email || !password) {
    return {
      ok: false,
      error:
        "En production, ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis : le compte administrateur de développement n'est pas créé.",
    };
  }
  if (!EMAIL_SHAPE.test(email)) {
    return { ok: false, error: "ADMIN_EMAIL n'est pas une adresse email valide." };
  }
  if (password === DEV_ADMIN_PASSWORD) {
    return { ok: false, error: "ADMIN_PASSWORD est le mot de passe de développement connu : en choisir un autre." };
  }
  if (password.length < MIN_PRODUCTION_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `ADMIN_PASSWORD doit faire au moins ${MIN_PRODUCTION_PASSWORD_LENGTH} caractères en production.`,
    };
  }
  return { ok: true, email, password, usesDevDefaults: false };
}
