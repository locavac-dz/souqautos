// Lot 120 — petites décisions de l'application installable, isolées pour être testées.

// iPhone, iPad et iPod : Safari n'émet pas `beforeinstallprompt` et n'installe que par
// « Partager → Sur l'écran d'accueil » ; on affiche donc une explication au lieu d'un bouton.
// (Un iPad récent se présente comme un Mac : `maxTouchPoints` le distingue.)
export function isIosDevice(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

// L'application est déjà installée (ouverte en mode « application », sans barre du navigateur).
export function isStandaloneDisplay({
  displayModeStandalone,
  iosStandalone,
}: {
  displayModeStandalone: boolean;
  iosStandalone: boolean | undefined;
}): boolean {
  return displayModeStandalone || iosStandalone === true;
}

// Proposer l'installation : jamais si l'application est déjà installée ; un bouton si le
// navigateur a fourni l'invite ; une explication sur iOS ; rien ailleurs (Firefox de
// bureau, invite déjà utilisée…).
export type InstallOffer = "none" | "button" | "ios-hint";

export function decideInstallOffer({
  standalone,
  hasPrompt,
  ios,
}: {
  standalone: boolean;
  hasPrompt: boolean;
  ios: boolean;
}): InstallOffer {
  if (standalone) return "none";
  if (hasPrompt) return "button";
  if (ios) return "ios-hint";
  return "none";
}
