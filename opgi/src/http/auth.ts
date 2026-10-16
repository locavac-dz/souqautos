// Handlers HTTP d'authentification (indépendants du framework : Request → Response).
import { authenticate, credentialsSchema } from "@/lib/auth/authenticate";
import { signSession } from "@/lib/auth/session";
import { buildSessionCookie, buildClearCookie } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/http/csrf";
import type { Services } from "@/lib/services";
import { json } from "@/http/respond";

export async function handleLogin(request: Request, s: Services): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return json(403, { error: "Origine non autorisée." });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(400, { error: "Corps de requête invalide." });
  }

  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) {
    return json(400, { error: "Identifiants au mauvais format." });
  }

  const resultat = await authenticate(parsed.data, {
    adminPrisma: s.admin,
    config: s.config,
    lockout: s.lockout,
  });
  if (resultat.statut === "2fa_requis") {
    // Le mot de passe était correct : on invite le client à fournir le code 2FA.
    return json(401, { error: "Code d'authentification requis.", twoFactorRequired: true });
  }
  if (resultat.statut !== "ok") {
    // Message volontairement générique (pas d'oracle sur l'existence du compte).
    return json(401, { error: "Identifiants invalides." });
  }

  const session = resultat.session;
  const token = await signSession(session, s.secret);
  const res = json(200, { organisationId: session.organisationId, role: session.role });
  res.headers.append("Set-Cookie", buildSessionCookie(token, { secure: s.secure }));
  return res;
}

export function handleLogout(request: Request, s: Services): Response {
  if (!isSameOriginRequest(request)) {
    return json(403, { error: "Origine non autorisée." });
  }
  const res = json(200, { ok: true });
  res.headers.append("Set-Cookie", buildClearCookie({ secure: s.secure }));
  return res;
}
