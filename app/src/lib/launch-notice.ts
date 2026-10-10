// Bandeau du tout premier lancement (LaunchNoticeBanner) : affiché 3 mois, puis retiré de lui-même
// (sans attendre une intervention manuelle). Date de fin à ajuster si la mise en ligne réelle diffère
// de la date d'écriture de ce lot (2026-10-10).
const LAUNCH_NOTICE_UNTIL = new Date("2027-01-10T00:00:00Z");

export function isLaunchNoticeActive(now: Date = new Date()): boolean {
  return now.getTime() < LAUNCH_NOTICE_UNTIL.getTime();
}
