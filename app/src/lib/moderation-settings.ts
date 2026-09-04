import { prisma } from "@/lib/prisma";

// Lot 47 — seuils de suspension automatique configurables depuis le
// back-office (écart documenté depuis le Lot 21). Valeurs par défaut =
// comportement historique inchangé (3/3), utilisées seulement si la ligne
// singleton venait à manquer (ne devrait jamais arriver après la migration).
export const DEFAULT_AUTO_SUSPEND_LISTING_THRESHOLD = 3;
export const DEFAULT_AUTO_SUSPEND_USER_THRESHOLD = 3;

export type ModerationSettingsValues = {
  autoSuspendListingThreshold: number;
  autoSuspendUserThreshold: number;
};

export async function getModerationSettings(): Promise<ModerationSettingsValues> {
  const settings = await prisma.moderationSettings.findUnique({ where: { id: "singleton" } });
  return {
    autoSuspendListingThreshold:
      settings?.autoSuspendListingThreshold ?? DEFAULT_AUTO_SUSPEND_LISTING_THRESHOLD,
    autoSuspendUserThreshold: settings?.autoSuspendUserThreshold ?? DEFAULT_AUTO_SUSPEND_USER_THRESHOLD,
  };
}

export type ThresholdValidation = { ok: true } | { ok: false; error: "invalid_threshold" };

// Bornes larges mais réelles : un seuil de 0 déclencherait une suspension sur
// le tout premier signalement même non corroboré par d'autres utilisateurs
// (contournerait l'esprit même du seuil) ; un seuil à trois chiffres n'a
// aucun sens opérationnel sur cette plateforme.
const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 50;

export function validateThreshold(value: number): ThresholdValidation {
  if (!Number.isInteger(value) || value < MIN_THRESHOLD || value > MAX_THRESHOLD) {
    return { ok: false, error: "invalid_threshold" };
  }
  return { ok: true };
}
