// Lot 273 — messages du formulaire de contact : référence, routage vers l'équipe, accusé de réception au client,
// transitions de statut. Tout ce qui est pur vit ici (testé sans réseau ni base) ; la route API orchestre.
import { randomInt } from "node:crypto";
import type { ContactStatus, ContactSubject } from "@prisma/client";
import { escapeHtml } from "@/lib/mailer";
import { parseAlertEmails } from "@/lib/alert-recipients";

export type ContactSubjectKey = "general" | "technical" | "pro" | "partnership" | "other";

export const CONTACT_SUBJECT_ENUM: Record<ContactSubjectKey, ContactSubject> = {
  general: "GENERAL",
  technical: "TECHNICAL",
  pro: "PRO",
  partnership: "PARTNERSHIP",
  other: "OTHER",
};

export const CONTACT_SUBJECT_KEY: Record<ContactSubject, ContactSubjectKey> = {
  GENERAL: "general",
  TECHNICAL: "technical",
  PRO: "pro",
  PARTNERSHIP: "partnership",
  OTHER: "other",
};

// Libellés internes (courriel à l'équipe, en français).
export const CONTACT_SUBJECT_LABEL_FR: Record<ContactSubjectKey, string> = {
  general: "Question générale",
  technical: "Problème technique",
  pro: "Renseignement pro / abonnement",
  partnership: "Partenariat",
  other: "Autre",
};

// Référence courte, lisible au téléphone, sans caractères ambigus (0/O, 1/I/L).
const REFERENCE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const REFERENCE_PATTERN = /^SA-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

export function generateContactReference(random: (max: number) => number = randomInt): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += REFERENCE_ALPHABET[random(REFERENCE_ALPHABET.length)];
  return `SA-${code}`;
}

type Env = Record<string, string | undefined>;

// Routage : les demandes commerciales (pro, partenariat) vont au PDG (ADMIN_EMAIL) ; le reste à la boîte partagée de
// l'équipe (STAFF_ALERT_EMAILS), à défaut au PDG. `fallbackDev` = adresse de développement acceptée hors production.
export function resolveContactRecipients(subject: ContactSubjectKey, env: Env, fallbackDev: string | null): string[] {
  const admin = env.ADMIN_EMAIL?.trim() || (env.NODE_ENV !== "production" ? fallbackDev : null);
  const team = parseAlertEmails(env.STAFF_ALERT_EMAILS);
  const commercial = subject === "pro" || subject === "partnership";

  if (commercial) return admin ? [admin] : team;
  if (team.length > 0) return team;
  return admin ? [admin] : [];
}

// Délai de réponse annoncé au client, par motif (heures ouvrées : affiché tel quel, c'est un engagement d'équipe).
export const CONTACT_RESPONSE_DELAY_KEY: Record<ContactSubjectKey, string> = {
  general: "delayGeneral",
  technical: "delayTechnical",
  pro: "delayPro",
  partnership: "delayPartnership",
  other: "delayOther",
};

// La FAQ n'est jointe qu'aux motifs où elle répond souvent à la question posée.
export function shouldAttachFaq(subject: ContactSubjectKey): boolean {
  return subject === "general" || subject === "technical";
}

export const FAQ_ITEMS = 5;

type Translate = (key: string, values?: Record<string, string>) => string;

// Accusé de réception au client, dans sa langue (namespace i18n « ContactEmails »).
export function buildContactAcknowledgement(
  t: Translate,
  input: { reference: string; name: string; subject: ContactSubjectKey; siteUrl: string; locale: string }
): { subject: string; html: string } {
  const name = escapeHtml(input.name);
  const reference = escapeHtml(input.reference);
  const parts = [
    `<p>${t("greeting", { name })}</p>`,
    `<p>${t("received", { reference })}</p>`,
    `<p>${t(CONTACT_RESPONSE_DELAY_KEY[input.subject])}</p>`,
  ];

  if (shouldAttachFaq(input.subject)) {
    parts.push(`<p><strong>${t("faqTitle")}</strong></p>`);
    for (let i = 1; i <= FAQ_ITEMS; i++) {
      parts.push(`<p><strong>${t(`faqQ${i}`)}</strong><br/>${t(`faqA${i}`)}</p>`);
    }
    parts.push(`<p>${t("noActionNeeded")}</p>`);
  }

  parts.push(`<p>${t("signature")}<br/><a href="${input.siteUrl}/${input.locale}">${escapeHtml(input.siteUrl)}</a></p>`);

  return { subject: t("ackSubject", { reference }), html: parts.join("") };
}

// Courriel interne à l'équipe (français) : tout le message, et Reply-To = le client pour répondre d'un clic.
export function buildTeamContactEmail(input: {
  reference: string;
  name: string;
  email: string;
  subject: ContactSubjectKey;
  message: string;
  locale: string;
  siteUrl: string;
}): { subject: string; html: string } {
  const label = CONTACT_SUBJECT_LABEL_FR[input.subject];
  const html = [
    `<p><strong>Référence :</strong> ${escapeHtml(input.reference)} · <strong>Motif :</strong> ${escapeHtml(label)} · <strong>Langue :</strong> ${escapeHtml(input.locale)}</p>`,
    `<p><strong>Nom :</strong> ${escapeHtml(input.name)}<br/><strong>Email :</strong> <a href="mailto:${escapeHtml(input.email)}">${escapeHtml(input.email)}</a></p>`,
    `<hr />`,
    `<p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>`,
    `<hr />`,
    `<p>Répondre directement à ce courriel écrit au client. Suivi : <a href="${input.siteUrl}/fr/admin/contact">${escapeHtml(input.siteUrl)}/fr/admin/contact</a></p>`,
  ].join("");
  return { subject: `[Contact] ${label} · ${input.reference} — ${input.name}`, html };
}

export type ContactAction = "take" | "answered" | "reopen";

export type ContactTransition = { ok: true; newStatus: ContactStatus } | { ok: false; error: "invalid_transition" };

export function computeContactTransition(current: ContactStatus, action: ContactAction): ContactTransition {
  switch (action) {
    case "take":
      return current === "NOUVEAU" ? { ok: true, newStatus: "PRIS_EN_CHARGE" } : { ok: false, error: "invalid_transition" };
    case "answered":
      return current === "REPONDU" ? { ok: false, error: "invalid_transition" } : { ok: true, newStatus: "REPONDU" };
    case "reopen":
      return current === "REPONDU" ? { ok: true, newStatus: "PRIS_EN_CHARGE" } : { ok: false, error: "invalid_transition" };
    default:
      return { ok: false, error: "invalid_transition" };
  }
}
