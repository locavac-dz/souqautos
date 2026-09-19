import { algerianPhoneRegex } from "@/lib/validation/phone";

// Lot 119 — liens de contact rapide (appel, WhatsApp) construits À LA DEMANDE par le
// serveur : le numéro n'est plus jamais envoyé avec la page d'une annonce.
// Logique pure, testée sans base.

// Numéro en chiffres internationaux sans « + » (« 213555123456 »), ou `null` si le
// numéro n'a pas le format algérien attendu (0[5-7]XXXXXXXX ou +213[5-7]XXXXXXXX).
// C'est le format exigé par wa.me ; `tel:` l'accepte aussi avec un « + ».
export function toInternationalDigits(phone: string): string | null {
  const trimmed = phone.trim();
  if (!algerianPhoneRegex.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  return digits.startsWith("213") ? digits : `213${digits.slice(1)}`;
}

export function buildTelUrl(phone: string): string | null {
  const digits = toInternationalDigits(phone);
  return digits ? `tel:+${digits}` : null;
}

export const CONTACT_LOCALES = ["fr", "ar"] as const;
export type ContactLocale = (typeof CONTACT_LOCALES)[number];

// Message pré-rempli : la première chose que le vendeur lit doit lui dire de quelle
// annonce il s'agit (les vendeurs en ont souvent plusieurs).
export function buildWhatsappMessage({ title, url, locale }: { title: string; url: string; locale: ContactLocale }): string {
  return locale === "ar"
    ? `مرحبًا، أنا مهتم بإعلانكم «${title}» على سوق أوتو : ${url}`
    : `Bonjour, je suis intéressé(e) par votre annonce « ${title} » sur Souq Auto : ${url}`;
}

export function buildWhatsappUrl(phone: string, message: string): string | null {
  const digits = toInternationalDigits(phone);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}
