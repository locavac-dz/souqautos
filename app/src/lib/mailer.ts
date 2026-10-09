import nodemailer from "nodemailer";
import { resolveMailConfig } from "@/lib/mail-config";

// Configuration résolue par src/lib/mail-config.ts (testée sans réseau) :
//  - SMTP_HOST défini : vrai fournisseur (Resend, AWS SES, Mailgun, serveur du
//    groupe…) ; SMTP_PORT, SMTP_USER/SMTP_PASS, SMTP_SECURE et SMTP_FROM
//    l'ajustent, sans changer le reste du code (même principe d'abstraction que
//    PaymentProvider, cf. docs/ARCHITECTURE.md §11).
//  - SMTP_HOST absent EN DÉVELOPPEMENT : compte de test Ethereal, qui accepte
//    réellement le protocole SMTP et expose un aperçu web consultable — jamais
//    une simulation en mémoire.
//  - SMTP_HOST absent EN PRODUCTION : erreur explicite (Lot 117). Auparavant, le
//    repli vers Ethereal aurait fait « envoyer » tous les courriels vers une
//    boîte de test que personne ne lit, sans aucune erreur visible.
let transporterPromise: ReturnType<typeof createTransporter> | null = null;

async function createTransporter() {
  const config = resolveMailConfig(process.env);
  if (config.mode === "error") {
    throw new Error(`[mailer] ${config.reason}`);
  }
  if (config.mode === "smtp") {
    return {
      from: config.from,
      transport: nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
        // Lot 268 (audit C5) — sans ces bornes, nodemailer attend jusqu'à 2 min la connexion et 10 min une réponse :
        // un serveur SMTP lent retenait d'autant les routes qui attendent un envoi.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      }),
    };
  }
  const account = await nodemailer.createTestAccount();
  return {
    from: config.from,
    transport: nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass },
    }),
  };
}

function getTransporter() {
  if (!transporterPromise) {
    // Ne jamais mettre en cache une promesse rejetée : sinon un seul échec
    // réseau transitoire (ex. création du compte Ethereal) casse l'envoi
    // d'email pour toute la durée de vie du process.
    transporterPromise = createTransporter().catch((err) => {
      transporterPromise = null;
      throw err;
    });
  }
  return transporterPromise;
}

// À utiliser sur toute donnée fournie par un utilisateur (nom, titre
// d'annonce, contenu de message...) interpolée dans un gabarit HTML — évite
// qu'un utilisateur puisse injecter du balisage dans un email envoyé à un tiers.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Lot 269 (audit E3) — envoi « au mieux » : un échec est journalisé avec son étiquette (jamais avalé en silence,
// comme le faisaient les `.catch(() => null)` des offres) et n'interrompt jamais l'action principale. À utiliser
// dans `after()` ou là où la réponse ne dépend pas de l'envoi.
export async function sendEmailBestEffort(tag: string, args: { to: string; subject: string; html: string }): Promise<{ previewUrl?: string } | null> {
  const result = await sendEmail(args).catch((err) => {
    console.error(`[EMAIL ${tag}] échec envoi: ${(err as Error).message}`);
    return null;
  });
  if (result?.previewUrl) console.log(`[EMAIL ${tag}] ${result.previewUrl}`);
  return result;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ previewUrl?: string }> {
  const { transport, from } = await getTransporter();
  const info = await transport.sendMail({
    from,
    to,
    subject,
    html,
  });
  const previewUrl = process.env.NODE_ENV !== "production" ? nodemailer.getTestMessageUrl(info) : false;
  return { previewUrl: previewUrl || undefined };
}
