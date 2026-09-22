// Lot 153 — message pré-rempli : interpolation des modèles de contact

export type ContactTemplateKey = "availability" | "price" | "testDrive";

export const CONTACT_TEMPLATE_KEYS: ContactTemplateKey[] = ["availability", "price", "testDrive"];

/** Construit le texte du message à partir d'un template i18n et du titre de l'annonce. */
export function buildContactMessage(templateText: string, listingTitle: string): string {
  return templateText.replace("{title}", listingTitle);
}
