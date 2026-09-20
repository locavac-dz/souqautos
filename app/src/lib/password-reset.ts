import { createHash, randomBytes } from "node:crypto";

// Lot 133 — « mot de passe oublié » : jeton, adresse du lien et texte des courriels. Logique pure, testée sans réseau.
// Le déroulement (recherche du compte, écriture en base, envoi) est dans src/lib/password-reset-service.ts.

export const RESET_TOKEN_TTL_MINUTES = 60;
export type ResetLocale = "fr" | "ar";

export function normalizeResetLocale(value: string | null | undefined): ResetLocale {
  return value === "ar" ? "ar" : "fr";
}

// 32 octets aléatoires (256 bits) : impossible à deviner, même en essayant très longtemps.
export function createResetToken(now: Date = new Date()): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashResetToken(token), expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60_000) };
}

// Seule l'empreinte est écrite en base : une copie de la base ne contient aucun lien utilisable. SHA-256 suffit (et
// non un hachage lent comme pour les mots de passe) : le jeton est déjà aléatoire, il n'y a rien à « deviner » ici.
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Forme exacte d'un jeton que nous avons émis : tout le reste est refusé avant même de toucher la base.
export function isPlausibleResetToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function buildResetLink(siteUrl: string, locale: ResetLocale, token: string): string {
  return `${siteUrl.replace(/\/$/, "")}/${locale}/reinitialiser-mot-de-passe/${token}`;
}

const wrap = (locale: ResetLocale, body: string) =>
  `<div dir="${locale === "ar" ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;line-height:1.6">${body}</div>`;

export function resetEmail(locale: ResetLocale, link: string): { subject: string; html: string } {
  if (locale === "ar") {
    return {
      subject: "إعادة تعيين كلمة المرور — سوق أوتو",
      html: wrap(
        "ar",
        `<p>مرحبًا،</p><p>وصلنا طلب لإعادة تعيين كلمة المرور الخاصة بحسابك على سوق أوتو. اضغط على الرابط التالي لاختيار كلمة مرور جديدة:</p><p><a href="${link}">${link}</a></p><p>هذا الرابط صالح لمدة ساعة واحدة ويُستعمل مرة واحدة فقط.</p><p>إذا لم تطلب ذلك، تجاهل هذه الرسالة: لن يتغير شيء في حسابك.</p>`
      ),
    };
  }
  return {
    subject: "Réinitialisation de votre mot de passe — Souq Auto",
    html: wrap(
      "fr",
      `<p>Bonjour,</p><p>Une demande de réinitialisation du mot de passe de votre compte Souq Auto a été faite. Cliquez sur ce lien pour choisir un nouveau mot de passe :</p><p><a href="${link}">${link}</a></p><p>Ce lien est valable ${RESET_TOKEN_TTL_MINUTES / 60} heure et ne peut servir qu'une fois.</p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : rien ne change sur votre compte.</p>`
    ),
  };
}

// Prévient la personne QUAND le mot de passe a effectivement changé : si ce n'est pas elle, c'est le seul moyen de le savoir.
export function passwordChangedEmail(locale: ResetLocale): { subject: string; html: string } {
  if (locale === "ar") {
    return {
      subject: "تم تغيير كلمة المرور — سوق أوتو",
      html: wrap("ar", `<p>مرحبًا،</p><p>تم تغيير كلمة المرور الخاصة بحسابك على سوق أوتو، وتم تسجيل خروجك من جميع الأجهزة.</p><p>إذا لم تكن أنت من قام بذلك، أعد تعيين كلمة المرور فورًا ثم تواصل معنا.</p>`),
    };
  }
  return {
    subject: "Votre mot de passe a été modifié — Souq Auto",
    html: wrap("fr", `<p>Bonjour,</p><p>Le mot de passe de votre compte Souq Auto vient d'être modifié, et tous vos appareils ont été déconnectés.</p><p>Si ce n'est pas vous, réinitialisez immédiatement votre mot de passe, puis contactez-nous.</p>`),
  };
}
