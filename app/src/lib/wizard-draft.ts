// Lot 44 — brouillon persistant de l'assistant de publication. Le contenu du
// brouillon (WizardData sérialisé) n'est jamais interprété ni validé champ
// par champ côté serveur : il n'est restitué qu'au même assistant, qui refait
// sa propre validation étape par étape avant toute publication réelle (cf.
// listingSchema, utilisé uniquement à la soumission finale). Seule une limite
// de taille protège contre un envoi abusif ou corrompu.
export const MAX_DRAFT_BYTES = 20_000;

export type DraftPayloadCheck = { ok: true } | { ok: false; error: "invalid_payload" | "too_large" };

export function checkDraftPayload(raw: unknown): DraftPayloadCheck {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "invalid_payload" };
  }
  const size = Buffer.byteLength(JSON.stringify(raw), "utf8");
  if (size > MAX_DRAFT_BYTES) {
    return { ok: false, error: "too_large" };
  }
  return { ok: true };
}
