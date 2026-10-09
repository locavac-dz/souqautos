// Lot 277 — affectation dans les files de modération (annonces, signalements) et activité de l'équipe.
//
// « Pris en charge par X » évite que deux personnes traitent le même élément ; la prise en charge est un
// `updateMany` filtré sur « personne encore » (atomique), la libération n'est permise qu'à la personne
// elle-même ou à un ADMIN. La décision (approbation, refus, traitement) efface l'affectation : l'élément
// sort de la file. L'activité par personne vient du journal d'audit — ce sont les décisions réelles.
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";

export type AssignmentAction = "take" | "release";
export type AssignmentKind = "listing" | "report";

export type AssignmentDecision =
  | { ok: true; data: { assignedToId: string | null; assignedAt: Date | null }; where: { assignedToId: string | null } }
  | { ok: false; error: "already_assigned" | "not_assigned" | "forbidden" };

// Pur : que faire, et sous quelle condition de course.
export function decideAssignment(input: {
  action: AssignmentAction;
  currentAssigneeId: string | null;
  user: { id: string; role: Role };
  now: Date;
}): AssignmentDecision {
  const { action, currentAssigneeId, user, now } = input;
  if (action === "take") {
    if (currentAssigneeId && currentAssigneeId !== user.id) return { ok: false, error: "already_assigned" };
    if (currentAssigneeId === user.id) return { ok: false, error: "already_assigned" };
    return { ok: true, data: { assignedToId: user.id, assignedAt: now }, where: { assignedToId: null } };
  }
  if (!currentAssigneeId) return { ok: false, error: "not_assigned" };
  if (currentAssigneeId !== user.id && !isAdmin(user.role)) return { ok: false, error: "forbidden" };
  return { ok: true, data: { assignedToId: null, assignedAt: null }, where: { assignedToId: currentAssigneeId } };
}

export type AssignmentResult = { ok: true; assignedToId: string | null } | { ok: false; error: "not_found" | "already_assigned" | "not_assigned" | "forbidden" | "race_lost" };

export async function assignModerationItem(input: {
  kind: AssignmentKind;
  id: string;
  action: AssignmentAction;
  user: { id: string; role: Role };
  now?: Date;
}): Promise<AssignmentResult> {
  const now = input.now ?? new Date();
  const model = input.kind === "listing" ? prisma.listing : prisma.report;
  const current = await (model as typeof prisma.listing).findUnique({ where: { id: input.id }, select: { assignedToId: true } });
  if (!current) return { ok: false, error: "not_found" };

  const decision = decideAssignment({ action: input.action, currentAssigneeId: current.assignedToId, user: input.user, now });
  if (!decision.ok) return { ok: false, error: decision.error };

  const { count } = await (model as typeof prisma.listing).updateMany({ where: { id: input.id, ...decision.where }, data: decision.data });
  if (count === 0) return { ok: false, error: "race_lost" };

  await writeAuditLog({
    adminId: input.user.id,
    action: `${input.kind}.${input.action === "take" ? "assign" : "release"}`,
    targetType: input.kind === "listing" ? "Listing" : "Report",
    targetId: input.id,
    details: { previousAssigneeId: current.assignedToId, assignedToId: decision.data.assignedToId },
  });

  return { ok: true, assignedToId: decision.data.assignedToId };
}

// Champs à joindre à toute décision (approbation, refus, traitement) : l'élément quitte la file.
export const CLEAR_ASSIGNMENT = { assignedToId: null, assignedAt: null } as const;

// --- Activité de l'équipe -------------------------------------------------------------------------------

export const LISTING_DECISION_ACTIONS = ["listing.approve", "listing.reject", "listing.suspend"] as const;
export const REPORT_DECISION_ACTIONS = ["report.resolve", "report.dismiss"] as const;

export type TeamActivityRow = {
  adminId: string;
  email: string;
  listings: number;
  reports: number;
  // Délai moyen entre le dépôt d'une annonce et la décision, en heures (null sans décision d'annonce).
  avgListingDelayHours: number | null;
  inProgress: number;
};

type DecisionLog = { adminId: string | null; action: string; targetId: string; createdAt: Date };

// Pur : agrège les décisions par membre. `listingCreatedAt` donne la date de dépôt des annonces décidées.
export function summarizeTeamActivity(input: {
  logs: DecisionLog[];
  listingCreatedAt: Map<string, Date>;
  emails: Map<string, string>;
  inProgressByAdmin: Map<string, number>;
}): TeamActivityRow[] {
  const rows = new Map<string, TeamActivityRow & { delaySum: number; delayCount: number }>();
  const row = (adminId: string) => {
    let r = rows.get(adminId);
    if (!r) {
      r = { adminId, email: input.emails.get(adminId) ?? adminId, listings: 0, reports: 0, avgListingDelayHours: null, inProgress: input.inProgressByAdmin.get(adminId) ?? 0, delaySum: 0, delayCount: 0 };
      rows.set(adminId, r);
    }
    return r;
  };

  for (const log of input.logs) {
    if (!log.adminId) continue;
    if ((LISTING_DECISION_ACTIONS as readonly string[]).includes(log.action)) {
      const r = row(log.adminId);
      r.listings++;
      const createdAt = input.listingCreatedAt.get(log.targetId);
      if (createdAt) {
        r.delaySum += (log.createdAt.getTime() - createdAt.getTime()) / 3_600_000;
        r.delayCount++;
      }
    } else if ((REPORT_DECISION_ACTIONS as readonly string[]).includes(log.action)) {
      row(log.adminId).reports++;
    }
  }
  for (const [adminId, count] of input.inProgressByAdmin) if (count > 0) row(adminId);

  return [...rows.values()]
    .map(({ delaySum, delayCount, ...r }) => ({ ...r, avgListingDelayHours: delayCount ? Math.round((delaySum / delayCount) * 10) / 10 : null }))
    .sort((a, b) => b.listings + b.reports - (a.listings + a.reports));
}

export async function loadTeamActivity(now: Date = new Date(), days = 7): Promise<TeamActivityRow[]> {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const logs = await prisma.auditLog.findMany({
    where: { createdAt: { gte: since }, action: { in: [...LISTING_DECISION_ACTIONS, ...REPORT_DECISION_ACTIONS] } },
    select: { adminId: true, action: true, targetId: true, createdAt: true },
  });
  const listingIds = [...new Set(logs.filter((l) => (LISTING_DECISION_ACTIONS as readonly string[]).includes(l.action)).map((l) => l.targetId))];
  const adminIds = [...new Set(logs.map((l) => l.adminId).filter((id): id is string => Boolean(id)))];
  const [listings, inProgress] = await Promise.all([
    listingIds.length ? prisma.listing.findMany({ where: { id: { in: listingIds } }, select: { id: true, createdAt: true } }) : [],
    prisma.listing.groupBy({ by: ["assignedToId"], where: { status: "EN_ATTENTE", assignedToId: { not: null } }, _count: { _all: true } }),
  ]);
  const inProgressByAdmin = new Map(inProgress.map((g) => [g.assignedToId as string, g._count._all]));
  const allAdminIds = [...new Set([...adminIds, ...inProgressByAdmin.keys()])];
  const users = allAdminIds.length ? await prisma.user.findMany({ where: { id: { in: allAdminIds } }, select: { id: true, email: true } }) : [];

  return summarizeTeamActivity({
    logs,
    listingCreatedAt: new Map(listings.map((l) => [l.id, l.createdAt])),
    emails: new Map(users.map((u) => [u.id, u.email])),
    inProgressByAdmin,
  });
}
