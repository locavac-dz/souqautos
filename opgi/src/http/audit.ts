// Handler HTTP de consultation du journal d'audit (lecture seule, réservée).
import { sessionFromCookieHeader } from "@/lib/auth/current-session";
import { resolveTenant } from "@/lib/tenant/resolve";
import { TenantResolutionError } from "@/lib/tenant/context";
import { withTenant } from "@/lib/tenant/prisma";
import { ROLES_LECTURE_AUDIT } from "@/lib/audit";
import type { Services } from "@/lib/services";
import { json } from "@/http/respond";

export async function handleAudit(request: Request, s: Services): Promise<Response> {
  const session = await sessionFromCookieHeader(request.headers.get("cookie"), s.secret, s.secure);
  if (!session) return json(401, { error: "Non authentifié." });

  let ctx;
  try {
    ctx = resolveTenant(session, s.config);
  } catch (e) {
    if (e instanceof TenantResolutionError) return json(403, { error: "Organisme refusé." });
    throw e;
  }

  // Le journal d'audit n'est pas un module métier : accès réservé à des rôles
  // explicites (administration de l'OPGI, direction, audit).
  if (!ROLES_LECTURE_AUDIT.has(session.role)) return json(403, { error: "Accès refusé." });

  const entries = await withTenant(s.app, ctx, (tx) =>
    tx.auditLog.findMany({
      where: { organisationId: ctx.organisationId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  );
  return json(200, { entries });
}
