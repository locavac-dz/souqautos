// Score de confiance (§26 du cahier d'architecture) : un agrégat mécanique de
// signaux vérifiables, jamais un jugement moral. Pondération heuristique et
// documentée (comme la formule de confiance de l'estimateur, §14), pas une
// calibration statistique. Volontairement absent : complétude des annonces
// (mesure jugée trop subjective) — à ajouter si un signal fiable existe un
// jour pour cet axe. La vérification d'identité (Lot 14) a rééquilibré les
// poids ci-dessous par rapport à la version initiale du Lot 12 (email/
// téléphone/ancienneté/avis réduits pour faire de la place à ce nouveau
// signal, le total restant plafonné à 100).
export type TrustSignals = {
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  accountAgeDays: number;
  reviewCount: number;
  averageRating: number;
  confirmedReportCount: number;
};

export type TrustScoreBreakdown = {
  score: number;
  emailPoints: number;
  phonePoints: number;
  identityPoints: number;
  agePoints: number;
  reviewPoints: number;
  reportPenalty: number;
};

export function accountAgeInDays(createdAt: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
}

const EMAIL_POINTS = 10;
const PHONE_POINTS = 10;
const IDENTITY_POINTS = 20;
const MAX_AGE_POINTS = 15;
const AGE_FULL_DAYS = 180;
const MAX_REVIEW_POINTS = 45;
const PENALTY_PER_CONFIRMED_REPORT = 10;

// Sans aucun avis, la composante avis contribue 0 sans pénaliser — un compte
// neuf mais entièrement vérifié (email+téléphone+identité) plafonne à
// 55/100 (10+10+20+15), présenté comme un score encore incomplet, jamais
// comme un score de méfiance.
export function computeTrustScore(signals: TrustSignals): TrustScoreBreakdown {
  const emailPoints = signals.emailVerified ? EMAIL_POINTS : 0;
  const phonePoints = signals.phoneVerified ? PHONE_POINTS : 0;
  const identityPoints = signals.identityVerified ? IDENTITY_POINTS : 0;
  const agePoints = Math.min(
    MAX_AGE_POINTS,
    Math.floor((Math.max(0, signals.accountAgeDays) / AGE_FULL_DAYS) * MAX_AGE_POINTS)
  );
  const reviewPoints =
    signals.reviewCount > 0 ? Math.round((signals.averageRating / 5) * MAX_REVIEW_POINTS) : 0;
  const reportPenalty = signals.confirmedReportCount * PENALTY_PER_CONFIRMED_REPORT;

  const rawScore = emailPoints + phonePoints + identityPoints + agePoints + reviewPoints - reportPenalty;
  const score = Math.max(0, Math.min(100, rawScore));

  return { score, emailPoints, phonePoints, identityPoints, agePoints, reviewPoints, reportPenalty };
}
