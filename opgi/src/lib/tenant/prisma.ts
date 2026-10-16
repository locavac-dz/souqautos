// Fabrique de client Prisma et exécution « sous organisme ».
//
// À l'exécution, l'application se connecte avec le rôle restreint `opgi_app`,
// SOUMIS à la Row-Level Security. Chaque unité de travail s'exécute dans une
// transaction où `app.org_id` est positionné localement : les politiques RLS
// (voir migrations/*/rls.sql) ne laissent alors voir/écrire que les lignes de
// cet organisme — même si une requête applicative oublie son filtre.

import { PrismaClient } from "@prisma/client";
import type { TenantContext } from "./context.js";

export type { PrismaClient };

/** Crée un client applicatif (rôle restreint, soumis RLS). */
export function createAppClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient(
    databaseUrl
      ? { datasources: { db: { url: databaseUrl } } }
      : undefined,
  );
}

/**
 * Exécute `fn` dans une transaction dont `app.org_id` vaut l'organisme du
 * contexte. `set_config(..., true)` est LOCAL à la transaction : la valeur ne
 * fuite pas sur la connexion suivante (sûr avec un pool de connexions).
 */
export async function withTenant<T>(
  prisma: PrismaClient,
  ctx: TenantContext,
  fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.org_id', ${ctx.organisationId}, true)`;
    return fn(tx);
  });
}
