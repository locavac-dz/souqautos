import { SITE_URL } from "@/lib/site";

// Lot 229 — avertissement envoyé à l'ANCIENNE adresse quand le changement d'adresse est confirmé : la personne dont le compte
// aurait été détourné doit l'apprendre là où elle lit encore son courrier, avec le moyen de réagir.
export type NoticeLocale = "fr" | "ar";

export function normalizeNoticeLocale(value: string | null | undefined): NoticeLocale {
  return value === "ar" ? "ar" : "fr";
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const wrap = (locale: NoticeLocale, body: string) =>
  `<div dir="${locale === "ar" ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;line-height:1.6">${body}</div>`;

export function emailChangedNoticeEmail(
  locale: NoticeLocale,
  { previousEmail, newEmail }: { previousEmail: string; newEmail: string }
): { subject: string; html: string } {
  const previous = escapeHtml(previousEmail);
  const next = escapeHtml(newEmail);
  const resetLink = `${SITE_URL}/${locale}/mot-de-passe-oublie`;
  if (locale === "ar") {
    return {
      subject: "تم تغيير عنوان البريد الإلكتروني لحسابك — Souq Auto",
      html: wrap(
        "ar",
        `<p>مرحباً،</p><p>تم للتو تغيير عنوان تسجيل الدخول إلى حسابك في Souq Auto من <strong>${previous}</strong> إلى <strong>${next}</strong>.</p><p>إذا كنت أنت من قام بهذا التغيير، فلا حاجة لأي إجراء.</p><p>إن لم يكن كذلك، فهناك من يملك الوصول إلى حسابك: أعد تعيين كلمة المرور فوراً من <a href="${resetLink}">${resetLink}</a> ثم اتصل بنا.</p>`
      ),
    };
  }
  return {
    subject: "L'adresse email de votre compte a été modifiée — Souq Auto",
    html: wrap(
      "fr",
      `<p>Bonjour,</p><p>L'adresse de connexion de votre compte Souq Auto vient de passer de <strong>${previous}</strong> à <strong>${next}</strong>.</p><p>Si vous êtes à l'origine de ce changement, aucune action n'est nécessaire.</p><p>Sinon, quelqu'un a accès à votre compte : réinitialisez votre mot de passe sans attendre depuis <a href="${resetLink}">${resetLink}</a>, puis contactez-nous.</p>`
    ),
  };
}
