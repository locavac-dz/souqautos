import nodemailer from "nodemailer";

// Aucun fournisseur réel configuré (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS) :
// on utilise un compte de test Ethereal, qui accepte réellement le protocole
// SMTP et expose un aperçu web consultable — jamais une simulation en mémoire.
// En production, définir les variables SMTP_* pour basculer vers un vrai
// fournisseur (Resend, AWS SES, Mailgun...) sans changer le reste du code —
// même principe d'abstraction indépendante du prestataire que PaymentProvider
// (cf. docs/ARCHITECTURE.md §11).
let transporterPromise: ReturnType<typeof createTransporter> | null = null;

async function createTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  const account = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass },
  });
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

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ previewUrl?: string }> {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: "Souq Auto <no-reply@souqauto.dz>",
    to,
    subject,
    html,
  });
  const previewUrl = nodemailer.getTestMessageUrl(info);
  return { previewUrl: previewUrl || undefined };
}
