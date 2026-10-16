// Fabrique des services applicatifs (clients Prisma, config, secret).
//
// - `app`   : rôle restreint `opgi_app` (DATABASE_URL), SOUMIS à la RLS — toutes
//             les requêtes métier passent par lui + `withTenant`.
// - `admin` : rôle propriétaire (DIRECT_DATABASE_URL), non soumis RLS — réservé
//             au seul bootstrap d'authentification (voir authenticate.ts).
import { PrismaClient } from "@prisma/client";
import { loadIsolationConfig, type IsolationConfig } from "@/lib/tenant/context";
import { DEFAULT_LOCKOUT, type LockoutPolicy } from "@/lib/auth/authenticate";

export interface Services {
  app: PrismaClient;
  admin: PrismaClient;
  config: IsolationConfig;
  secret: string;
  secure: boolean;
  lockout: LockoutPolicy;
  /** Répertoire de base du stockage local des pièces jointes. */
  storageDir: string;
}

export function buildServices(env: Record<string, string | undefined> = process.env): Services {
  const databaseUrl = env.DATABASE_URL;
  const directUrl = env.DIRECT_DATABASE_URL ?? databaseUrl;
  const secret = env.SESSION_SECRET ?? "";
  // Par défaut, cookies Secure en production ; `COOKIE_SECURE` force explicitement
  // l'un ou l'autre (utile pour un test local en http).
  const secure =
    env.COOKIE_SECURE !== undefined
      ? env.COOKIE_SECURE === "true"
      : env.NODE_ENV === "production";

  const lockout = {
    maxAttempts: env.LOGIN_MAX_ATTEMPTS ? Number(env.LOGIN_MAX_ATTEMPTS) : DEFAULT_LOCKOUT.maxAttempts,
    lockMs: env.LOGIN_LOCK_MINUTES ? Number(env.LOGIN_LOCK_MINUTES) * 60_000 : DEFAULT_LOCKOUT.lockMs,
  };

  return {
    app: new PrismaClient(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined),
    admin: new PrismaClient(directUrl ? { datasources: { db: { url: directUrl } } } : undefined),
    config: loadIsolationConfig(env),
    secret,
    secure,
    lockout,
    storageDir: env.FILE_STORAGE_DIR ?? ".data/uploads",
  };
}

// Singleton pour l'exécution Next (évite d'épuiser le pool en développement).
declare global {
  // eslint-disable-next-line no-var
  var __opgiServices: Services | undefined;
}

export function getServices(): Services {
  if (!globalThis.__opgiServices) globalThis.__opgiServices = buildServices();
  return globalThis.__opgiServices;
}
