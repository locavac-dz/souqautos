// Handler HTTP de consultation du journal d'audit (lecture seule, réservée).
import { sessionFromCookieHeader } from "@/lib/auth/current-session";
import { sessionRevoquee } from "@/lib/auth/revocation";
import { resolveTenant } from "@/lib/tenant/resolve";
import { TenantResolutionError } from "@/lib/tenant/context";
import { withTenant } from "@/lib/tenant/prisma";
import { ROLES_LECTURE_AUDIT, listAudit, countAudit, type AuditListeOpts } from "@/lib/audit";
import type { Services } from "@/lib/services";
import { json } from "@/http/respond";
import { parseListParams, pageHeaders } from "@/http/pagination";

/** Normalise le paramètre `resultat` (SUCCES/ECHEC) sinon undefined. */
function parseResultat(v: string | null): "SUCCES" | "ECHEC" | undefined {
  return v === "SUCCES" || v === "ECHEC" ? v : undefined;
}

export async function handleAudit(request: Request, s: Services): Promise<Response> {
  const session = await sessionFromCookieHeader(request.headers.get("cookie"), s.secret, s.secure);
  if (!session) return json(401, { error: "Non authentifié." });
  if (await sessionRevoquee(session, s.admin)) return json(401, { error: "Session expirée." });

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

  const p = parseListParams(request.url);
  const opts: AuditListeOpts = {
    q: p.q,
    resultat: parseResultat(new URL(request.url).searchParams.get("resultat")),
    skip: p.skip,
    take: p.take,
  };
  const [entries, total] = await withTenant(s.app, ctx, async (tx) => [
    await listAudit(tx, ctx.organisationId, opts),
    await countAudit(tx, ctx.organisationId, opts),
  ]);
  return json(200, { entries }, { headers: pageHeaders(total, p) });
}
