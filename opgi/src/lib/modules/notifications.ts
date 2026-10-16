// Notifications internes. Cloisonnées par organisme (RLS) ET par destinataire :
// chaque utilisateur ne lit/marque que les siennes. Émises dans la transaction
// `withTenant` de l'événement déclencheur (atomicité).
//
// Canal externe (email/SMS) : volontairement HORS de ce module et désactivé par
// défaut (adaptateur à brancher, avec journalisation d'envoi/échec/reprise, sans
// divulguer de donnée sensible) — brief §7.
import type { Tx } from "@/lib/modules/a/service";
import type { Acteur } from "@/lib/modules/c/service";

export interface NouvelleNotification {
  destinataireUtilisateurId: string;
  type: string;
  titre: string;
  corps?: string | null;
  lien?: string | null;
}

export function notifier(tx: Tx, organisationId: string, n: NouvelleNotification) {
  return tx.notification.create({
    data: {
      organisationId,
      destinataireUtilisateurId: n.destinataireUtilisateurId,
      type: n.type,
      titre: n.titre,
      corps: n.corps ?? null,
      lien: n.lien ?? null,
    },
  });
}

export function listNotifications(
  tx: Tx,
  organisationId: string,
  acteur: Acteur,
  opts: { nonLuesSeulement?: boolean } = {},
) {
  return tx.notification.findMany({
    where: {
      organisationId,
      destinataireUtilisateurId: acteur.utilisateurId,
      ...(opts.nonLuesSeulement ? { lu: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export function compteNonLues(tx: Tx, organisationId: string, acteur: Acteur) {
  return tx.notification.count({
    where: { organisationId, destinataireUtilisateurId: acteur.utilisateurId, lu: false },
  });
}

/** Marque une notification comme lue — seulement si elle appartient à l'acteur. */
export async function marquerLue(tx: Tx, organisationId: string, acteur: Acteur, id: string) {
  const res = await tx.notification.updateMany({
    where: { id, organisationId, destinataireUtilisateurId: acteur.utilisateurId },
    data: { lu: true, luLe: new Date() },
  });
  return res.count > 0;
}
