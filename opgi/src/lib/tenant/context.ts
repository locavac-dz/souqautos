// Contexte d'organisme (tenant) et configuration d'isolation.
//
// Règle D3 : l'organisme actif provient TOUJOURS de la session vérifiée côté
// serveur. Aucune valeur fournie par le navigateur (en-tête, cookie non signé,
// paramètre de requête, corps JSON) n'est acceptée comme preuve d'organisme.

import { z } from "zod";

/** Modes d'exploitation (décision D2 — « les deux dès le départ »). */
export type IsolationMode = "shared" | "dedicated";

/**
 * Session déjà vérifiée côté serveur (signature/validité contrôlées en amont).
 * `organisationId` y est inscrit par le serveur au moment de l'authentification,
 * jamais recopié depuis une entrée client.
 */
export interface VerifiedSession {
  utilisateurId: string;
  organisationId: string;
  role: string;
  perimetre?: string | null;
  /** « Epoch » de révocation porté par le jeton (0 par défaut / jetons anciens). */
  epoch?: number;
}

/** Contexte d'organisme résolu, prêt à filtrer les accès aux données. */
export interface TenantContext {
  organisationId: string;
  mode: IsolationMode;
}

const isolationConfigSchema = z
  .object({
    ISOLATION_MODE: z.enum(["shared", "dedicated"]).default("shared"),
    ORGANISATION_ID: z.string().min(1).optional(),
  })
  .refine(
    (c) => c.ISOLATION_MODE !== "dedicated" || !!c.ORGANISATION_ID,
    "ORGANISATION_ID est obligatoire en mode d'isolation `dedicated`.",
  );

export interface IsolationConfig {
  mode: IsolationMode;
  /** En mode `dedicated` : l'unique organisme de l'instance. */
  organisationId?: string;
}

/** Charge et valide la configuration d'isolation depuis l'environnement. */
export function loadIsolationConfig(
  env: Record<string, string | undefined> = process.env,
): IsolationConfig {
  const parsed = isolationConfigSchema.parse({
    ISOLATION_MODE: env.ISOLATION_MODE,
    ORGANISATION_ID: env.ORGANISATION_ID,
  });
  return { mode: parsed.ISOLATION_MODE, organisationId: parsed.ORGANISATION_ID };
}

export class TenantResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantResolutionError";
  }
}
