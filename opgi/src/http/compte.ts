// Handlers HTTP du compte de l'utilisateur courant (changement de mot de passe).
import { z } from "zod";
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authenticateSession } from "@/http/guard";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import {
  changerMotDePasse,
  statutTOTP,
  debuterTOTP,
  activerTOTP,
  desactiverTOTP,
} from "@/lib/auth/account";
import { recordAudit } from "@/lib/audit";

const changeSchema = z.object({
  ancien: z.string().min(1),
  nouveau: z.string().min(1).max(200),
});

const codeSchema = z.object({ code: z.string().trim().min(1) });
const motDePasseSchema = z.object({ motDePasse: z.string().min(1) });

const TOTP_EMETTEUR = "Plateforme OPGI";

// PATCH /api/compte/motdepasse
export async function handleChangePassword(request: Request, s: Services): Promise<Response> {
  if (request.method !== "PATCH") return json(405, { error: "Méthode non autorisée." });

  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  const auth = await authenticateSession(request, s);
  if (auth instanceof Response) return auth;

  const body = await parseBody(request, changeSchema);
  if (body instanceof Response) return body;

  // Robustesse : longueur minimale configurable (sans règle de complexité imposée).
  if (body.nouveau.length < s.passwordMinLength) {
    return json(400, {
      error: `Le nouveau mot de passe doit comporter au moins ${s.passwordMinLength} caractères.`,
    });
  }
  if (body.nouveau === body.ancien) {
    return json(400, { error: "Le nouveau mot de passe doit différer de l'ancien." });
  }

  try {
    const resultat = await withTenant(s.app, auth.ctx, async (tx) => {
      const r = await changerMotDePasse(
        tx,
        auth.ctx.organisationId,
        auth.session.utilisateurId,
        body.ancien,
        body.nouveau,
      );
      if (r === "ok") {
        await recordAudit(tx, auth.ctx.organisationId, {
          utilisateurId: auth.session.utilisateurId,
          action: "compte.motdepasse.change",
          objetType: "Utilisateur",
          objetId: auth.session.utilisateurId,
          resume: "Changement de mot de passe en self-service.",
        });
      }
      return r;
    });

    if (resultat === "mauvais_ancien") {
      return json(400, { error: "Mot de passe actuel incorrect." });
    }
    if (resultat === "introuvable") {
      return json(404, { error: "Compte introuvable." });
    }
    return json(200, { change: true });
  } catch (e) {
    return mapError(e);
  }
}

// GET /api/compte/2fa — statut de la 2FA de l'utilisateur courant.
export async function handle2faStatut(request: Request, s: Services): Promise<Response> {
  const auth = await authenticateSession(request, s);
  if (auth instanceof Response) return auth;
  const statut = await withTenant(s.app, auth.ctx, (tx) =>
    statutTOTP(tx, auth.ctx.organisationId, auth.session.utilisateurId),
  );
  return statut ? json(200, statut) : json(404, { error: "Compte introuvable." });
}

// POST /api/compte/2fa/debut — génère un secret provisoire + URI otpauth.
export async function handle2faDebut(request: Request, s: Services): Promise<Response> {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  const auth = await authenticateSession(request, s);
  if (auth instanceof Response) return auth;
  const r = await withTenant(s.app, auth.ctx, (tx) =>
    debuterTOTP(tx, auth.ctx.organisationId, auth.session.utilisateurId, TOTP_EMETTEUR),
  );
  if (r.statut === "deja_actif") return json(409, { error: "La 2FA est déjà active." });
  if (r.statut === "introuvable") return json(404, { error: "Compte introuvable." });
  return json(200, { secret: r.secret, uri: r.uri });
}

// POST /api/compte/2fa/activer — active après preuve d'un code.
export async function handle2faActiver(request: Request, s: Services): Promise<Response> {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  const auth = await authenticateSession(request, s);
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, codeSchema);
  if (body instanceof Response) return body;
  const r = await withTenant(s.app, auth.ctx, async (tx) => {
    const res = await activerTOTP(tx, auth.ctx.organisationId, auth.session.utilisateurId, body.code);
    if (res === "ok") {
      await recordAudit(tx, auth.ctx.organisationId, {
        utilisateurId: auth.session.utilisateurId,
        action: "compte.2fa.activer",
        objetType: "Utilisateur",
        objetId: auth.session.utilisateurId,
        resume: "Activation de la 2FA (TOTP).",
      });
    }
    return res;
  });
  if (r === "ok") return json(200, { actif: true });
  if (r === "deja_actif") return json(409, { error: "La 2FA est déjà active." });
  if (r === "pas_de_secret") return json(409, { error: "Aucune 2FA en cours d'initiation." });
  if (r === "introuvable") return json(404, { error: "Compte introuvable." });
  return json(400, { error: "Code invalide." });
}

// POST /api/compte/2fa/desactiver — désactive après preuve du mot de passe.
export async function handle2faDesactiver(request: Request, s: Services): Promise<Response> {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;
  const auth = await authenticateSession(request, s);
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, motDePasseSchema);
  if (body instanceof Response) return body;
  const r = await withTenant(s.app, auth.ctx, async (tx) => {
    const res = await desactiverTOTP(
      tx,
      auth.ctx.organisationId,
      auth.session.utilisateurId,
      body.motDePasse,
    );
    if (res === "ok") {
      await recordAudit(tx, auth.ctx.organisationId, {
        utilisateurId: auth.session.utilisateurId,
        action: "compte.2fa.desactiver",
        objetType: "Utilisateur",
        objetId: auth.session.utilisateurId,
        resume: "Désactivation de la 2FA (TOTP).",
      });
    }
    return res;
  });
  if (r === "ok") return json(200, { actif: false });
  if (r === "mauvais_mot_de_passe") return json(400, { error: "Mot de passe incorrect." });
  return json(404, { error: "Compte introuvable." });
}
