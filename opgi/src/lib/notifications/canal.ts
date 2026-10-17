// Canal de notification EXTERNE (email/SMS/webhook) — brief §7.
//
// Principes :
//  - DÉSACTIVÉ par défaut (aucun fournisseur imposé ni « règle » inventée) ;
//  - adaptateur générique par WEBHOOK (l'intégrateur branche son relais
//    email/SMS derrière cette URL) ;
//  - dispatch BEST-EFFORT et HORS transaction DB : jamais d'I/O réseau dans la
//    transaction de l'événement (elle reste courte et atomique), et un échec
//    d'envoi externe n'annule JAMAIS la notification interne déjà persistée ;
//  - JOURNALISATION sans donnée sensible : on ne transmet/journalise que des
//    identifiants et le type — jamais le titre, le corps, l'e-mail ou le
//    téléphone du destinataire.

export type EnvoiResultat = "envoye" | "desactive" | "echec";

/** Charge utile externe VOLONTAIREMENT minimale (aucune donnée sensible). */
export interface MessageExterne {
  organisationId: string;
  notificationId: string;
  destinataireUtilisateurId: string;
  type: string;
  lien?: string | null;
}

export interface CanalExterne {
  readonly actif: boolean;
  envoyer(message: MessageExterne): Promise<EnvoiResultat>;
}

/** Journal structuré (par défaut : console). Jamais de contenu sensible. */
export interface Journal {
  enregistrer(evenement: Record<string, unknown>): void;
}

export const journalConsole: Journal = {
  enregistrer(evenement) {
    // eslint-disable-next-line no-console
    console.info(JSON.stringify({ ts: new Date().toISOString(), ...evenement }));
  },
};

/** Canal nul : aucun envoi (comportement par défaut). */
export const canalDesactive: CanalExterne = {
  actif: false,
  async envoyer() {
    return "desactive";
  },
};

/** Adaptateur générique : POST JSON (payload minimal) vers une URL de relais. */
export class CanalWebhook implements CanalExterne {
  readonly actif = true;
  constructor(
    private readonly url: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async envoyer(message: MessageExterne): Promise<EnvoiResultat> {
    const res = await this.fetchImpl(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message),
    });
    return res.ok ? "envoye" : "echec";
  }
}

/** Fabrique le canal depuis l'environnement (désactivé sauf configuration). */
export function canalDepuisEnv(env: Record<string, string | undefined> = process.env): CanalExterne {
  if (env.NOTIF_CANAL === "webhook" && env.NOTIF_WEBHOOK_URL) {
    return new CanalWebhook(env.NOTIF_WEBHOOK_URL);
  }
  return canalDesactive;
}

/**
 * Tente l'envoi externe et journalise le résultat, SANS jamais lever : un échec
 * est tracé puis avalé (la notification interne reste la source de vérité).
 */
export async function dispatcherExterne(
  canal: CanalExterne,
  journal: Journal,
  message: MessageExterne,
): Promise<EnvoiResultat> {
  if (!canal.actif) return "desactive";
  let statut: EnvoiResultat;
  try {
    statut = await canal.envoyer(message);
  } catch {
    statut = "echec";
  }
  journal.enregistrer({
    evt: "notification.externe",
    organisationId: message.organisationId,
    notificationId: message.notificationId,
    destinataireUtilisateurId: message.destinataireUtilisateurId,
    type: message.type,
    statut,
  });
  return statut;
}
