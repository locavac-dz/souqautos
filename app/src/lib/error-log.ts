import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { maskSensitive } from "@/lib/server-error-alerts";

// Lot 293 — persistance des erreurs en base (monitoring interne).
//
// Trois sources : erreurs serveur (instrumentation + apiHandler), erreurs client (error boundaries),
// violations CSP (route /api/security/csp-report). Chaque erreur reçoit une empreinte (fingerprint)
// qui regroupe les occurrences identiques dans le tableau de bord admin.
//
// Ne lève JAMAIS d'exception : une erreur de journalisation ne doit pas aggraver la panne.

export type ErrorLogKind = "server" | "client" | "csp";

export type ErrorLogEntry = {
  kind: ErrorLogKind;
  message: string;
  stack?: string | null;
  route?: string | null;
  method?: string | null;
  context?: string | null;
  statusCode?: number | null;
  userAgent?: string | null;
};

const MESSAGE_MAX = 500;
const STACK_MAX = 4000;
const UA_MAX = 300;
const ROUTE_MAX = 200;

export function errorFingerprint(kind: string, route: string | null | undefined, message: string): string {
  const firstLine = message.split("\n").find(Boolean) ?? "";
  return createHash("sha256").update(`${kind}|${route ?? ""}|${firstLine}`).digest("hex").slice(0, 16);
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

export async function logError(entry: ErrorLogEntry): Promise<void> {
  try {
    const message = maskSensitive(entry.message).slice(0, MESSAGE_MAX);
    const fingerprint = errorFingerprint(entry.kind, entry.route, entry.message);

    await prisma.errorLog.create({
      data: {
        kind: entry.kind,
        fingerprint,
        message,
        stack: truncate(entry.stack, STACK_MAX),
        route: truncate(entry.route, ROUTE_MAX),
        method: truncate(entry.method, 10),
        context: truncate(entry.context, 20),
        statusCode: entry.statusCode ?? null,
        userAgent: truncate(entry.userAgent, UA_MAX),
      },
    });
  } catch {
    // volontairement silencieux
  }
}

const RETENTION_DAYS = 30;
const MAX_ROWS = 10_000;

export async function sweepOldErrorLogs(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const byDate = await prisma.errorLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  let removed = byDate.count;

  const total = await prisma.errorLog.count();
  if (total > MAX_ROWS) {
    const oldest = await prisma.errorLog.findMany({
      orderBy: { createdAt: "asc" },
      take: total - MAX_ROWS,
      select: { id: true },
    });
    if (oldest.length > 0) {
      const trimmed = await prisma.errorLog.deleteMany({ where: { id: { in: oldest.map((r) => r.id) } } });
      removed += trimmed.count;
    }
  }

  return removed;
}
