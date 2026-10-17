// Journal d'audit (transverse). Écriture DANS la transaction `withTenant` de
// l'action auditée : l'entrée d'audit et la donnée métier sont validées ou
// annulées ensemble (atomicité). Ne jamais consigner de donnée personnelle
// sensible dans `resume` (minimisation, brief §9).
import type { Tx } from "@/lib/modules/a/service";

export interface AuditEntry {
  utilisateurId?: string | null;
  action: string;
  objetType: string;
  objetId?: string | null;
  resultat?: "SUCCES" | "ECHEC";
  resume?: string | null;
}

export function recordAudit(tx: Tx, organisationId: string, e: AuditEntry) {
  return tx.auditLog.create({
    data: {
      organisationId,
      utilisateurId: e.utilisateurId ?? null,
      action: e.action,
      objetType: e.objetType,
      objetId: e.objetId ?? null,
      resultat: e.resultat ?? "SUCCES",
      resume: e.resume ?? null,
    },
  });
}

/** Rôles autorisés à consulter le journal d'audit de leur organisme. */
export const ROLES_LECTURE_AUDIT: ReadonlySet<string> = new Set([
  "ADMIN_OPGI",
  "DIRECTION",
  "AUDITEUR",
]);

export interface AuditListeOpts {
  q?: string;
  resultat?: "SUCCES" | "ECHEC";
  skip?: number;
  take?: number;
}

function whereAudit(organisationId: string, o: AuditListeOpts) {
  return {
    organisationId,
    ...(o.resultat ? { resultat: o.resultat } : {}),
    ...(o.q
      ? {
          OR: [
            { action: { contains: o.q, mode: "insensitive" as const } },
            { objetType: { contains: o.q, mode: "insensitive" as const } },
            { resume: { contains: o.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

export function listAudit(tx: Tx, organisationId: string, o: AuditListeOpts = {}) {
  return tx.auditLog.findMany({
    where: whereAudit(organisationId, o),
    orderBy: { createdAt: "desc" },
    skip: o.skip,
    take: o.take ?? 200,
  });
}

export function countAudit(tx: Tx, organisationId: string, o: AuditListeOpts = {}) {
  return tx.auditLog.count({ where: whereAudit(organisationId, o) });
}
