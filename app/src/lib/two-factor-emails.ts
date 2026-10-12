// Lot 138 — courriels d'avertissement de sécurité de la double authentification. Logique pure, testée sans réseau.
//
// Chaque changement qui touche à la protection du compte est signalé À LA PERSONNE : si ce n'est pas elle qui l'a fait (compte
// pris, code de secours volé), c'est le seul moyen de s'en apercevoir. Le courriel ne contient jamais de code, de clé ni de lien.
export type TwoFactorNoticeKind = "enabled" | "disabled" | "recovery_used" | "recovery_regenerated" | "reset_by_admin";
export type NoticeLocale = "fr" | "ar";

export function normalizeNoticeLocale(value: string | null | undefined): NoticeLocale {
  return value === "ar" ? "ar" : "fr";
}

const wrap = (locale: NoticeLocale, body: string) => `<div dir="${locale === "ar" ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;line-height:1.6">${body}</div>`;

const FR: Record<TwoFactorNoticeKind, (remaining: number) => { subject: string; text: string }> = {
  enabled: () => ({ subject: "Double authentification activée — Souq Autos", text: "La double authentification vient d'être activée sur votre compte Souq Autos. Vos autres appareils ont été déconnectés." }),
  disabled: () => ({ subject: "Double authentification désactivée — Souq Autos", text: "La double authentification vient d'être désactivée sur votre compte Souq Autos : un simple mot de passe suffit de nouveau pour vous connecter." }),
  recovery_used: (remaining) => ({
    subject: "Un code de secours a été utilisé — Souq Autos",
    text: `Un de vos codes de secours vient d'être utilisé pour vous connecter à votre compte Souq Autos. Il vous en reste ${remaining}.`,
  }),
  recovery_regenerated: () => ({ subject: "Nouveaux codes de secours — Souq Autos", text: "De nouveaux codes de secours ont été générés pour votre compte Souq Autos. Les précédents ne fonctionnent plus." }),
  reset_by_admin: () => ({
    subject: "Double authentification réinitialisée — Souq Autos",
    text: "Notre équipe a réinitialisé la double authentification de votre compte Souq Autos, et vos appareils ont été déconnectés. Activez-la de nouveau dès votre prochaine connexion.",
  }),
};

const AR: Record<TwoFactorNoticeKind, (remaining: number) => { subject: string; text: string }> = {
  enabled: () => ({ subject: "تم تفعيل المصادقة الثنائية — سوق أوتو", text: "تم تفعيل المصادقة الثنائية على حسابك في سوق أوتو، وتم تسجيل خروجك من الأجهزة الأخرى." }),
  disabled: () => ({ subject: "تم إيقاف المصادقة الثنائية — سوق أوتو", text: "تم إيقاف المصادقة الثنائية على حسابك في سوق أوتو، وأصبحت كلمة المرور وحدها كافية لتسجيل الدخول." }),
  recovery_used: (remaining) => ({
    subject: "تم استخدام رمز استرداد — سوق أوتو",
    text: `تم استخدام أحد رموز الاسترداد الخاصة بك لتسجيل الدخول إلى حسابك في سوق أوتو. المتبقي لديك ${remaining}.`,
  }),
  recovery_regenerated: () => ({ subject: "رموز استرداد جديدة — سوق أوتو", text: "تم إنشاء رموز استرداد جديدة لحسابك في سوق أوتو، ولم تعد الرموز السابقة صالحة." }),
  reset_by_admin: () => ({
    subject: "تمت إعادة ضبط المصادقة الثنائية — سوق أوتو",
    text: "أعاد فريقنا ضبط المصادقة الثنائية لحسابك في سوق أوتو، وتم تسجيل خروجك من أجهزتك. فعّلها من جديد عند تسجيل دخولك التالي.",
  }),
};

export function twoFactorNoticeEmail(kind: TwoFactorNoticeKind, locale: NoticeLocale, remainingRecoveryCodes = 0): { subject: string; html: string } {
  const { subject, text } = (locale === "ar" ? AR : FR)[kind](remainingRecoveryCodes);
  const greeting = locale === "ar" ? "مرحبًا،" : "Bonjour,";
  const warning =
    locale === "ar"
      ? "إذا لم تكن أنت من قام بذلك، فغيّر كلمة المرور فورًا وتواصل معنا."
      : "Si ce n'est pas vous, changez votre mot de passe immédiatement et contactez-nous.";
  return { subject, html: wrap(locale, `<p>${greeting}</p><p>${text}</p><p>${warning}</p>`) };
}
