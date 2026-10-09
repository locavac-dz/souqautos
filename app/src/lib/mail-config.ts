// Lot 117 — configuration de l'envoi d'emails, isolée pour être testée sans réseau.
//
// Avant ce lot, l'absence de SMTP_HOST faisait basculer SILENCIEUSEMENT vers un
// compte de test Ethereal, y compris en production : les courriels (vérification
// d'adresse, décisions de modération, notifications) auraient été « envoyés » vers
// une boîte de test que personne ne lit, sans aucune erreur visible. En
// production, un SMTP non configuré est maintenant une erreur explicite.

export const DEFAULT_MAIL_FROM = "Souq Auto <no-reply@souqauto.dz>";

export type MailConfig =
  | {
      mode: "smtp";
      host: string;
      port: number;
      secure: boolean;
      auth: { user: string; pass: string } | undefined;
      from: string;
      replyTo: string | undefined;
    }
  | { mode: "test"; from: string; replyTo: string | undefined }
  | { mode: "error"; reason: string };

type Env = Record<string, string | undefined>;

// Lot 273 — adresse de réponse de TOUS les courriels sortants : un client qui répond à une notification doit
// tomber sur une boîte lue par l'équipe, pas sur l'expéditeur technique « no-reply ». MAIL_REPLY_TO explicite,
// sinon la première adresse d'alerte de l'équipe, sinon ADMIN_EMAIL ; sans rien, pas d'en-tête (comme avant).
export function resolveReplyTo(env: Env): string | undefined {
  const explicit = env.MAIL_REPLY_TO?.trim();
  if (explicit) return explicit;
  const firstStaff = env.STAFF_ALERT_EMAILS?.split(",").map((s) => s.trim()).find(Boolean);
  if (firstStaff) return firstStaff;
  const admin = env.ADMIN_EMAIL?.trim();
  return admin || undefined;
}

export function resolveMailConfig(env: Env): MailConfig {
  const from = env.SMTP_FROM?.trim() || DEFAULT_MAIL_FROM;
  const replyTo = resolveReplyTo(env);
  const host = env.SMTP_HOST?.trim();

  if (!host) {
    if (env.NODE_ENV === "production") {
      return {
        mode: "error",
        reason:
          "SMTP_HOST n'est pas défini : en production, aucun courriel ne peut être envoyé. Renseigner SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (et SMTP_FROM).",
      };
    }
    return { mode: "test", from, replyTo };
  }

  const port = env.SMTP_PORT ? Number(env.SMTP_PORT) : 587;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { mode: "error", reason: `SMTP_PORT invalide : « ${env.SMTP_PORT} ».` };
  }

  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  // Un identifiant sans mot de passe (ou l'inverse) est presque toujours une
  // faute de configuration : mieux vaut le dire que d'échouer à l'envoi.
  if (Boolean(user) !== Boolean(pass)) {
    return { mode: "error", reason: "SMTP_USER et SMTP_PASS doivent être renseignés ensemble." };
  }

  // Le port 465 est le SMTP « implicite TLS » ; les autres ports négocient TLS
  // (STARTTLS). SMTP_SECURE permet de forcer le choix.
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE.toLowerCase() === "true" : port === 465;

  return { mode: "smtp", host, port, secure, auth: user && pass ? { user, pass } : undefined, from, replyTo };
}
