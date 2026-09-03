export type MessagingCheck =
  | { ok: true }
  | { ok: false; error: "cannot_message_self" | "blocked" };

// Règles pures pour savoir si un envoi de message (ou l'ouverture d'une
// conversation) doit être autorisé — testées indépendamment de Prisma/l'API.
export function checkCanMessage({
  isSelf,
  isBlocked,
}: {
  isSelf: boolean;
  isBlocked: boolean;
}): MessagingCheck {
  if (isSelf) return { ok: false, error: "cannot_message_self" };
  if (isBlocked) return { ok: false, error: "blocked" };
  return { ok: true };
}

// Anti-spam : une notification email n'est envoyée que pour le premier message
// non lu d'une série — si le destinataire a déjà un ou plusieurs messages non
// lus de cet expéditeur dans cette conversation, on ne renvoie pas un email à
// chaque nouveau message tant qu'il n'a pas relu le fil.
export function shouldSendMessageNotification({
  unreadCountBeforeThisMessage,
}: {
  unreadCountBeforeThisMessage: number;
}): boolean {
  return unreadCountBeforeThisMessage === 0;
}

// Comblement du plus vieux écart encore ouvert (Lot 8) : « supprimer » une
// conversation ne détruit jamais les messages de l'autre partie — seulement un
// masquage par utilisateur (hiddenByBuyerAt/hiddenBySellerAt sur Conversation).
export function isConversationHiddenFor({
  isBuyer,
  hiddenByBuyerAt,
  hiddenBySellerAt,
}: {
  isBuyer: boolean;
  hiddenByBuyerAt: Date | null;
  hiddenBySellerAt: Date | null;
}): boolean {
  return isBuyer ? hiddenByBuyerAt !== null : hiddenBySellerAt !== null;
}

export type MessageDeleteEligibility =
  | { ok: true }
  | { ok: false; error: "not_sender" | "already_deleted" };

// Comblement du second écart du Lot 8 (Lot 38) : suppression « pour tout le
// monde », jamais « pour moi seulement » — seul l'expéditeur d'un message
// peut le supprimer, jamais le destinataire (qui pourrait sinon effacer une
// preuve dont il n'est pas l'auteur). Même philosophie anti-contournement que
// les autres suppressions de ce projet (jamais un simple masquage local qui
// ferait disparaître une preuve utile en cas de litige/signalement).
export function checkCanDeleteMessage({
  isSender,
  alreadyDeleted,
}: {
  isSender: boolean;
  alreadyDeleted: boolean;
}): MessageDeleteEligibility {
  if (!isSender) return { ok: false, error: "not_sender" };
  if (alreadyDeleted) return { ok: false, error: "already_deleted" };
  return { ok: true };
}

export type MessageContentCheck = { ok: true } | { ok: false; error: "empty_message" };

// Lot 39 — pièces jointes : un message doit contenir du texte, une pièce
// jointe, ou les deux, jamais ni l'un ni l'autre (le texte seul n'est plus le
// seul contenu possible depuis l'ajout de l'image).
export function checkMessageHasContent({
  hasText,
  hasAttachment,
}: {
  hasText: boolean;
  hasAttachment: boolean;
}): MessageContentCheck {
  if (!hasText && !hasAttachment) return { ok: false, error: "empty_message" };
  return { ok: true };
}
