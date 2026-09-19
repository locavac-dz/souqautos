import { z } from "zod";

// Lot 123 — suivi des prospects d'un compte professionnel : logique pure, testée sans base.
//
// Un prospect est une personne IDENTIFIÉE qui a écrit au vendeur à propos d'une annonce (une
// conversation). Les visiteurs qui affichent seulement un numéro ne sont pas identifiés : ils
// comptent dans les statistiques, jamais ici.

export const PROSPECT_STATUSES = ["NOUVEAU", "A_RAPPELER", "EN_NEGOCIATION", "GAGNE", "PERDU"] as const;
export type ProspectStatusValue = (typeof PROSPECT_STATUSES)[number];
export const DEFAULT_PROSPECT_STATUS: ProspectStatusValue = "NOUVEAU";

// Statuts qui demandent encore une action de l'équipe : les autres sont soldés (vendu ou perdu).
export const OPEN_PROSPECT_STATUSES: readonly ProspectStatusValue[] = ["NOUVEAU", "A_RAPPELER", "EN_NEGOCIATION"];

export const MAX_PROSPECT_NOTE_LENGTH = 500;

// Filtre `?statut=` venu de l'adresse : toute valeur inconnue = pas de filtre.
export function parseProspectStatusFilter(raw: string | string[] | undefined): ProspectStatusValue | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (PROSPECT_STATUSES as readonly string[]).includes(value ?? "") ? (value as ProspectStatusValue) : null;
}

// Corps de la modification : le statut, la note, ou les deux. Une note vide efface la note.
export const prospectUpdateSchema = z
  .object({
    status: z.enum(PROSPECT_STATUSES).optional(),
    note: z
      .string()
      .max(MAX_PROSPECT_NOTE_LENGTH)
      .transform((value) => {
        const trimmed = value.trim();
        return trimmed === "" ? null : trimmed;
      })
      .nullable()
      .optional(),
  })
  .strict()
  .refine((value) => value.status !== undefined || value.note !== undefined, { message: "empty_update" });
export type ProspectUpdate = z.infer<typeof prospectUpdateSchema>;

export type ProspectLastMessage = { senderId: string; createdAt: Date } | null;

// La balle est dans le camp de l'équipe quand le dernier message (non supprimé) vient de l'acheteur.
// Une conversation sans aucun message n'attend rien.
export function isAwaitingReply(lastMessage: ProspectLastMessage, buyerId: string): boolean {
  return lastMessage !== null && lastMessage.senderId === buyerId;
}

export type ProspectRowBase = {
  conversationId: string;
  status: ProspectStatusValue;
  awaitingReply: boolean;
  // Dernière activité : le dernier message, à défaut la création de la conversation.
  lastActivityAt: Date;
};

// D'abord ceux qui attendent une réponse et ne sont pas soldés, puis les plus récents.
export function sortProspects<T extends ProspectRowBase>(rows: T[]): T[] {
  const needsAction = (row: T) => row.awaitingReply && OPEN_PROSPECT_STATUSES.includes(row.status);
  return [...rows].sort((a, b) => {
    const byAction = Number(needsAction(b)) - Number(needsAction(a));
    if (byAction !== 0) return byAction;
    return b.lastActivityAt.getTime() - a.lastActivityAt.getTime() || a.conversationId.localeCompare(b.conversationId);
  });
}

export function countByStatus(rows: Pick<ProspectRowBase, "status">[]): Record<ProspectStatusValue, number> {
  const counts = Object.fromEntries(PROSPECT_STATUSES.map((s) => [s, 0])) as Record<ProspectStatusValue, number>;
  for (const row of rows) counts[row.status] += 1;
  return counts;
}
