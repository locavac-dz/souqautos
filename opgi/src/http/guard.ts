// Garde HTTP commune : session → organisme → autorisation. Renvoie soit le
// contexte autorisé, soit une Response d'erreur (401/403) à retourner telle quelle.
import { sessionFromCookieHeader } from "@/lib/auth/current-session";
import { sessionRevoquee } from "@/lib/auth/revocation";
import { resolveTenant } from "@/lib/tenant/resolve";
import {
  TenantResolutionError,
  type TenantContext,
  type VerifiedSession,
} from "@/lib/tenant/context";
import {
  assertCan,
  AuthorizationError,
  type Action,
  type ModuleKey,
  type RoleName,
} from "@/lib/authz/permissions";
import type { Services } from "@/lib/services";
import { json } from "@/http/respond";

export interface AuthorizedContext {
  session: VerifiedSession;
  ctx: TenantContext;
}

/**
 * Garde « session seule » : vérifie la session et résout l'organisme, SANS
 * exiger de permission de module. Pour les endpoints propres au compte de
 * l'utilisateur courant (ex. changement de son mot de passe), que tout
 * utilisateur authentifié peut effectuer sur lui-même.
 */
export async function authenticateSession(
  request: Request,
  s: Services,
): Promise<AuthorizedContext | Response> {
  const session = await sessionFromCookieHeader(request.headers.get("cookie"), s.secret, s.secure);
  if (!session) return json(401, { error: "Non authentifié." });
  if (await sessionRevoquee(session, s.admin)) return json(401, { error: "Session expirée." });
  try {
    const ctx = resolveTenant(session, s.config);
    return { session, ctx };
  } catch (e) {
    if (e instanceof TenantResolutionError) return json(403, { error: "Organisme refusé." });
    throw e;
  }
}

export async function authorize(
  request: Request,
  s: Services,
  module: ModuleKey,
  action: Action,
): Promise<AuthorizedContext | Response> {
  const session = await sessionFromCookieHeader(request.headers.get("cookie"), s.secret, s.secure);
  if (!session) return json(401, { error: "Non authentifié." });
  if (await sessionRevoquee(session, s.admin)) return json(401, { error: "Session expirée." });

  let ctx: TenantContext;
  try {
    ctx = resolveTenant(session, s.config);
  } catch (e) {
    if (e instanceof TenantResolutionError) return json(403, { error: "Organisme refusé." });
    throw e;
  }

  try {
    assertCan(session.role as RoleName, module, action);
  } catch (e) {
    if (e instanceof AuthorizationError) return json(403, { error: "Accès refusé." });
    throw e;
  }

  return { session, ctx };
}
