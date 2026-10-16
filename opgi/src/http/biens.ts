// Handler HTTP : liste des biens de l'organisme actif (Module A, lecture).
// Démontre la chaîne complète : session → organisme → autorisation → requête
// isolée (withTenant). Indépendant du framework.
import { sessionFromCookieHeader } from "@/lib/auth/current-session";
import { resolveTenant } from "@/lib/tenant/resolve";
import { withTenant } from "@/lib/tenant/prisma";
import { assertCan, type RoleName } from "@/lib/authz/permissions";
import { TenantResolutionError } from "@/lib/tenant/context";
import { AuthorizationError } from "@/lib/authz/permissions";
import type { Services } from "@/lib/services";
import { json } from "@/http/respond";

export async function handleListBiens(request: Request, s: Services): Promise<Response> {
  const session = await sessionFromCookieHeader(request.headers.get("cookie"), s.secret, s.secure);
  if (!session) return json(401, { error: "Non authentifié." });

  let ctx;
  try {
    ctx = resolveTenant(session, s.config);
  } catch (e) {
    if (e instanceof TenantResolutionError) return json(403, { error: "Organisme refusé." });
    throw e;
  }

  try {
    assertCan(session.role as RoleName, "A", "lire");
  } catch (e) {
    if (e instanceof AuthorizationError) return json(403, { error: "Accès refusé." });
    throw e;
  }

  const biens = await withTenant(s.app, ctx, (tx) =>
    tx.bien.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, type: true, etatOccupation: true, adresse: true },
    }),
  );
  return json(200, { organisationId: ctx.organisationId, biens });
}
