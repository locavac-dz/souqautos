import type { ListingStatus } from "@prisma/client";

// Durée de validité d'une annonce publiée avant expiration automatique —
// comblement du plus vieux écart documenté (Lot 2) : les statuts BROUILLON,
// VENDUE et EXPIREE existaient dans le schéma depuis le Lot 1/2 mais aucun
// code ne les atteignait jamais. Constante en dur, pas configurable depuis
// le back-office (cf. décisions du Lot 21 pour AUTO_SUSPEND_LISTING_THRESHOLD).
export const LISTING_VALIDITY_DAYS = 30;

export function computeExpiryDate(from: Date, days: number = LISTING_VALIDITY_DAYS): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  return result;
}

export function isListingExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return now.getTime() >= expiresAt.getTime();
}

export type ListingActionEligibility =
  | { ok: true }
  | { ok: false; error: "invalid_status" };

// Renouveler ou marquer vendue ne doivent être possibles que depuis PUBLIEE ou
// EXPIREE — jamais depuis SUSPENDUE/REFUSEE, qui contourneraient sinon une
// décision de modération humaine, ni depuis VENDUE, un état terminal.
const OWNER_ACTIONABLE_STATUSES: ListingStatus[] = ["PUBLIEE", "EXPIREE"];

export function checkListingRenewable(status: ListingStatus): ListingActionEligibility {
  return OWNER_ACTIONABLE_STATUSES.includes(status)
    ? { ok: true }
    : { ok: false, error: "invalid_status" };
}

export function checkListingCanBeMarkedSold(status: ListingStatus): ListingActionEligibility {
  return OWNER_ACTIONABLE_STATUSES.includes(status)
    ? { ok: true }
    : { ok: false, error: "invalid_status" };
}

// Modifier le prix suit la même règle que renouveler/marquer vendue : jamais
// depuis SUSPENDUE/REFUSEE (contournerait la modération), ni depuis VENDUE.
export function checkListingPriceEditable(status: ListingStatus): ListingActionEligibility {
  return OWNER_ACTIONABLE_STATUSES.includes(status)
    ? { ok: true }
    : { ok: false, error: "invalid_status" };
}

// Édition générale (Lot 30) : mêmes statuts que le prix (Lot 23), plus
// BROUILLON (Lot 41 — import de stock en masse crée des annonces sans photo
// dans cet état, la seule façon de les compléter est cette même édition).
// Contrairement au prix, une édition de contenu renvoie l'annonce en
// modération (cf. route), donc l'éligibilité seule ne suffit pas à la rendre
// invisible : c'est le changement de statut côté route qui s'en charge.
const CONTENT_EDITABLE_STATUSES: ListingStatus[] = ["BROUILLON", "PUBLIEE", "EXPIREE"];

export function checkListingContentEditable(status: ListingStatus): ListingActionEligibility {
  return CONTENT_EDITABLE_STATUSES.includes(status)
    ? { ok: true }
    : { ok: false, error: "invalid_status" };
}

// Lot 48 — rappel email avant expiration, balayé paresseusement comme
// l'expiration elle-même (aucun scheduler dans cette application, cf.
// sweepExpiredListings). Fenêtre en jours avant expiresAt pendant laquelle un
// rappel doit être envoyé, une seule fois par cycle (reminderSentAt).
export const EXPIRY_REMINDER_WINDOW_DAYS = 3;

export function shouldSendExpiryReminder({
  expiresAt,
  reminderSentAt,
  now = new Date(),
}: {
  expiresAt: Date | null;
  reminderSentAt: Date | null;
  now?: Date;
}): boolean {
  if (!expiresAt || reminderSentAt) return false;
  if (isListingExpired(expiresAt, now)) return false; // déjà expirée : sweepExpiredListings s'en charge
  const windowStart = new Date(expiresAt);
  windowStart.setDate(windowStart.getDate() - EXPIRY_REMINDER_WINDOW_DAYS);
  return now.getTime() >= windowStart.getTime();
}

// Comblement du second écart documenté du Lot 5 : les favoris n'ont jamais
// notifié leurs auteurs d'une baisse de prix, faute d'infra de notification —
// l'email réel existe depuis le Lot 11/18/21, il ne restait qu'à détecter la
// baisse elle-même (aucune modification de prix n'était même possible avant
// ce lot : jusqu'ici, une annonce publiée ne pouvait jamais être éditée).
export function isPriceDrop(oldPrice: number, newPrice: number): boolean {
  return newPrice < oldPrice;
}
