// Destinataires des alertes envoyées à l'équipe par courriel. Module volontairement LÉGER (aucune base de données, aucun
// envoi) : les scripts d'exploitation (npm run ops:check) et le serveur l'utilisent tous les deux.
//
//  - STAFF_ALERT_EMAILS : l'équipe (modération : contenus en attente ; Lot 118).
//  - OPS_ALERT_EMAILS   : les personnes chargées du fonctionnement technique (sauvegardes, erreurs du serveur ; Lot 136).
//    Non défini : les alertes techniques vont à STAFF_ALERT_EMAILS (petite équipe, mêmes personnes).
// Aucun des deux : aucune alerte (les problèmes ne sont alors visibles que dans les journaux).

export const MAX_ALERT_RECIPIENTS = 10;

const EMAIL_SHAPE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

export function parseAlertEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,;]/)) {
    const email = part.trim().toLowerCase();
    if (EMAIL_SHAPE.test(email)) seen.add(email);
  }
  return [...seen].slice(0, MAX_ALERT_RECIPIENTS);
}

export function resolveOpsRecipients(env: Record<string, string | undefined>): string[] {
  const ops = parseAlertEmails(env.OPS_ALERT_EMAILS);
  return ops.length > 0 ? ops : parseAlertEmails(env.STAFF_ALERT_EMAILS);
}
