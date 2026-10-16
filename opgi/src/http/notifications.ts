// Handlers HTTP des notifications de l'utilisateur courant. Personnelles : pas
// de permission de module, mais une session valide et l'organisme de la session.
import { sessionFromCookieHeader } from "@/lib/auth/current-session";
import { resolveTenant } from "@/lib/tenant/resolve";
import { TenantResolutionError, type TenantContext } from "@/lib/tenant/context";
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { csrfGuard } from "@/http/helpers";
import { json } from "@/http/respond";
import { listNotifications, compteNonLues, marquerLue } from "@/lib/modules/notifications";
import type { Acteur } from "@/lib/modules/c/service";

async function contexte(
  request: Request,
  s: Services,
): Promise<{ ctx: TenantContext; acteur: Acteur } | Response> {
  const session = await sessionFromCookieHeader(request.headers.get("cookie"), s.secret, s.secure);
  if (!session) return json(401, { error: "Non authentifié." });
  try {
    const ctx = resolveTenant(session, s.config);
    return { ctx, acteur: { utilisateurId: session.utilisateurId, role: session.role } };
  } catch (e) {
    if (e instanceof TenantResolutionError) return json(403, { error: "Organisme refusé." });
    throw e;
  }
}

export async function handleNotifications(request: Request, s: Services): Promise<Response> {
  const c = await contexte(request, s);
  if (c instanceof Response) return c;
  const nonLuesSeulement = new URL(request.url).searchParams.get("nonLues") === "1";
  const [notifications, nonLues] = await withTenant(s.app, c.ctx, async (tx) => [
    await listNotifications(tx, c.ctx.organisationId, c.acteur, { nonLuesSeulement }),
    await compteNonLues(tx, c.ctx.organisationId, c.acteur),
  ]);
  return json(200, { notifications, nonLues });
}

export async function handleNotificationLue(request: Request, s: Services, id: string): Promise<Response> {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  if (request.method !== "POST") return json(405, { error: "Méthode non autorisée." });
  const c = await contexte(request, s);
  if (c instanceof Response) return c;
  const ok = await withTenant(s.app, c.ctx, (tx) => marquerLue(tx, c.ctx.organisationId, c.acteur, id));
  return ok ? json(200, { lu: true }) : json(404, { error: "Introuvable." });
}
