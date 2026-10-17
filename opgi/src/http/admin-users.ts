// Handlers HTTP de l'administration des comptes d'un organisme (ADMIN_OPGI).
// Isolation par `withTenant` (RLS) : un administrateur ne voit et ne modifie
// que les comptes de SON organisme. Chaque mutation est tracée au journal
// d'audit (sans donnée sensible : jamais de mot de passe).
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authorizeAdminOpgi } from "@/http/guard";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import { recordAudit } from "@/lib/audit";
import {
  utilisateurCreateSchema,
  utilisateurUpdateSchema,
  resetMotDePasseSchema,
} from "@/lib/auth/admin-schemas";
import { listComptes, creerCompte, modifierCompte, reinitialiserMotDePasse } from "@/lib/auth/admin-users";

export async function handleAdminUtilisateurs(request: Request, s: Services): Promise<Response> {
  if (request.method === "POST") {
    const csrf = csrfGuard(request);
    if (csrf) return csrf;
    const auth = await authorizeAdminOpgi(request, s);
    if (auth instanceof Response) return auth;
    const body = await parseBody(request, utilisateurCreateSchema);
    if (body instanceof Response) return body;
    if (body.password.length < s.passwordMinLength) {
      return json(400, {
        error: `Le mot de passe doit comporter au moins ${s.passwordMinLength} caractères.`,
      });
    }
    try {
      const compte = await withTenant(s.app, auth.ctx, async (tx) => {
        const c = await creerCompte(tx, auth.ctx.organisationId, body);
        await recordAudit(tx, auth.ctx.organisationId, {
          utilisateurId: auth.session.utilisateurId,
          action: "compte.create",
          objetType: "Utilisateur",
          objetId: c.id,
          resume: `${c.email} (${c.role})`,
        });
        return c;
      });
      return json(201, { compte });
    } catch (e) {
      return mapError(e);
    }
  }

  const auth = await authorizeAdminOpgi(request, s);
  if (auth instanceof Response) return auth;
  const comptes = await withTenant(s.app, auth.ctx, (tx) => listComptes(tx, auth.ctx.organisationId));
  return json(200, { comptes });
}

export async function handleAdminUtilisateur(request: Request, s: Services, id: string): Promise<Response> {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  if (request.method !== "PATCH") return json(405, { error: "Méthode non autorisée." });
  const auth = await authorizeAdminOpgi(request, s);
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, utilisateurUpdateSchema);
  if (body instanceof Response) return body;
  try {
    const compte = await withTenant(s.app, auth.ctx, async (tx) => {
      const c = await modifierCompte(tx, auth.ctx.organisationId, auth.session.utilisateurId, id, body);
      if (c) {
        await recordAudit(tx, auth.ctx.organisationId, {
          utilisateurId: auth.session.utilisateurId,
          action: "compte.update",
          objetType: "Utilisateur",
          objetId: c.id,
          resume: `role=${c.role} actif=${c.actif}`,
        });
      }
      return c;
    });
    return compte ? json(200, { compte }) : json(404, { error: "Introuvable." });
  } catch (e) {
    return mapError(e);
  }
}

export async function handleAdminMotDePasse(request: Request, s: Services, id: string): Promise<Response> {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  if (request.method !== "POST") return json(405, { error: "Méthode non autorisée." });
  const auth = await authorizeAdminOpgi(request, s);
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, resetMotDePasseSchema);
  if (body instanceof Response) return body;
  if (body.password.length < s.passwordMinLength) {
    return json(400, {
      error: `Le mot de passe doit comporter au moins ${s.passwordMinLength} caractères.`,
    });
  }
  const ok = await withTenant(s.app, auth.ctx, async (tx) => {
    const done = await reinitialiserMotDePasse(tx, auth.ctx.organisationId, id, body.password);
    if (done) {
      await recordAudit(tx, auth.ctx.organisationId, {
        utilisateurId: auth.session.utilisateurId,
        action: "compte.reset_mdp",
        objetType: "Utilisateur",
        objetId: id,
        resume: "réinitialisation du mot de passe",
      });
    }
    return done;
  });
  return ok ? json(200, { reinitialise: true }) : json(404, { error: "Introuvable." });
}
