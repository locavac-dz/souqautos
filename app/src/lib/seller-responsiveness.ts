// Lot 141 — la réactivité d'un vendeur : répond-il aux acheteurs qui le contactent, et en combien de temps ?
//
// Calculée à partir des VRAIES conversations, jamais déclarée par le vendeur. Affichée aux acheteurs sous forme de badge
// POSITIF seulement (« Répond généralement en moins de 2 h ») : l'absence de badge ne veut pas dire « mauvais vendeur », elle
// veut dire « pas encore assez de conversations, ou pas (encore) assez réactif ». Un vendeur qui débute n'est jamais montré du
// doigt. Le vendeur, lui, voit ses chiffres réels dans son espace, pour savoir quoi améliorer.
//
// Décisions, et pourquoi :
//  - FENÊTRE de 90 jours : c'est le comportement RÉCENT qui intéresse l'acheteur. Un vendeur qui s'est amélioré n'est pas
//    puni pour l'an dernier ; un vendeur devenu inactif ne garde pas un badge mérité autrefois.
//  - DÉLAI DE GRÂCE de 48 h : une conversation ouverte il y a dix minutes et encore sans réponse n'est PAS un échec — elle est
//    simplement trop récente pour être jugée, donc exclue du calcul. Sans cela, un vendeur serait pénalisé par les messages
//    qu'il est en train de lire.
//  - MINIMUM de 5 conversations jugeables : en dessous, aucun badge. « 100 % de réponses » sur une seule conversation ne veut
//    rien dire, et l'afficher serait trompeur.
//  - TAUX minimal de 80 % : le badge dit « répond », il doit être vrai la grande majorité du temps.
//  - MÉDIANE et non moyenne pour le délai : une seule absence prolongée ne doit pas effacer des centaines de réponses rapides.
//    Elle est calculée sur les conversations RÉELLEMENT répondues ; le taux, lui, tient compte de celles restées sans réponse.
// Module pur (aucune base, aucune horloge cachée) : testé dans tests/seller-responsiveness.test.ts.

export const RESPONSIVENESS_WINDOW_DAYS = 90;
export const RESPONSIVENESS_GRACE_HOURS = 48;
export const RESPONSIVENESS_MIN_CONVERSATIONS = 5;
export const RESPONSIVENESS_MIN_RATE = 0.8;
// Un vendeur est jugé sur ses 200 conversations les PLUS RÉCENTES de la fenêtre : au-delà, la mesure n'apprendrait plus rien
// et cette page est vue à chaque consultation d'annonce. Un concessionnaire très actif ne ralentit donc jamais le site.
export const RESPONSIVENESS_MAX_CONVERSATIONS = 200;

// Une conversation vue du calcul : quand l'acheteur a écrit en premier, et quand le vendeur lui a répondu (si un jour).
export type ConversationTiming = { buyerFirstMessageAt: Date; sellerFirstReplyAt: Date | null };

export type Responsiveness = {
  // Conversations retenues : dans la fenêtre, et jugeables (répondues, ou sans réponse depuis plus que le délai de grâce).
  eligibleConversations: number;
  respondedConversations: number;
  responseRate: number; // 0 à 1 ; 0 quand rien n'est jugeable
  medianReplyMinutes: number | null; // null quand aucune réponse dans la fenêtre
};

// Les seules formulations possibles du badge, de la plus flatteuse à la plus modeste. Au-delà de 24 h : aucun badge.
export type ResponsivenessBadge = "under1h" | "under2h" | "under6h" | "under24h";

const MINUTE = 60_000;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function computeResponsiveness(conversations: readonly ConversationTiming[], now: Date): Responsiveness {
  const windowStart = now.getTime() - RESPONSIVENESS_WINDOW_DAYS * 24 * 60 * MINUTE;
  const graceLimit = now.getTime() - RESPONSIVENESS_GRACE_HOURS * 60 * MINUTE;

  const delays: number[] = [];
  let eligible = 0;
  for (const conversation of conversations) {
    const asked = conversation.buyerFirstMessageAt.getTime();
    if (asked < windowStart || asked > now.getTime()) continue; // hors fenêtre (ou horloge incohérente)

    const replied = conversation.sellerFirstReplyAt?.getTime();
    // Une « réponse » antérieure à la question n'en est pas une : sécurité contre des données incohérentes.
    if (replied !== undefined && replied >= asked) {
      eligible += 1;
      delays.push((replied - asked) / MINUTE);
    } else if (asked <= graceLimit) {
      eligible += 1; // sans réponse, et assez ancienne pour être jugée
    }
  }

  return {
    eligibleConversations: eligible,
    respondedConversations: delays.length,
    responseRate: eligible === 0 ? 0 : delays.length / eligible,
    medianReplyMinutes: delays.length === 0 ? null : median(delays),
  };
}

// Le badge, ou rien. Jamais de badge sur un échantillon trop petit, un taux trop faible, ou un délai supérieur à 24 h.
export function responsivenessBadge(responsiveness: Responsiveness): ResponsivenessBadge | null {
  const { eligibleConversations, responseRate, medianReplyMinutes } = responsiveness;
  if (eligibleConversations < RESPONSIVENESS_MIN_CONVERSATIONS) return null;
  if (responseRate < RESPONSIVENESS_MIN_RATE) return null;
  if (medianReplyMinutes === null) return null;
  if (medianReplyMinutes <= 60) return "under1h";
  if (medianReplyMinutes <= 120) return "under2h";
  if (medianReplyMinutes <= 360) return "under6h";
  if (medianReplyMinutes <= 1440) return "under24h";
  return null;
}

// Ce qui manque au vendeur pour obtenir le badge — affiché à LUI SEUL, dans son espace, pour qu'il sache quoi faire.
export type ResponsivenessGap = "not_enough" | "rate_too_low" | "too_slow" | null;

export function responsivenessGap(responsiveness: Responsiveness): ResponsivenessGap {
  if (responsivenessBadge(responsiveness) !== null) return null;
  if (responsiveness.eligibleConversations < RESPONSIVENESS_MIN_CONVERSATIONS) return "not_enough";
  if (responsiveness.responseRate < RESPONSIVENESS_MIN_RATE) return "rate_too_low";
  return "too_slow";
}
