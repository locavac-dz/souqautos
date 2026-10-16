// Handlers HTTP du compte de l'utilisateur courant (changement de mot de passe).
import { z } from "zod";
import { withTenant } from "@/lib/tenant/prisma";
import type { Services } from "@/lib/services";
import { authenticateSession } from "@/http/guard";
import { csrfGuard, parseBody, mapError } from "@/http/helpers";
import { json } from "@/http/respond";
import { changerMotDePasse } from "@/lib/auth/account";
import { recordAudit } from "@/lib/audit";

const changeSchema = z.object({
  ancien: z.string().min(1),
  nouveau: z.string().min(1).max(200),
});

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
