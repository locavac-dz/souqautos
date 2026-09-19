import { normalizeSourceUrl } from "@/lib/press-review";

// Lot 115 — source d'un article du magazine rédigé à partir d'un document
// externe (dossier de presse d'un constructeur, communiqué…). Le texte est
// toujours celui de la rédaction : la source est seulement citée, avec un lien
// facultatif vers la page du document.

export const SOURCE_NAME_MIN = 2;
export const SOURCE_NAME_MAX = 120;

export type SourceInput = { sourceName?: string | null; sourceUrl?: string | null };

export type ResolvedSource =
  | { ok: true; sourceName: string | null; sourceUrl: string | null }
  | { ok: false; error: "source_name_required" | "source_name_length" | "source_url_invalid" };

// Vide = pas de source. Un lien sans nom n'a pas de sens pour le lecteur (il ne
// saurait pas ce qu'il ouvre) ; un lien doit être une adresse https:// sûre
// (mêmes règles que la revue de presse) et est enregistré sous sa forme normalisée.
export function resolveSource(input: SourceInput): ResolvedSource {
  const name = input.sourceName?.trim() ?? "";
  const rawUrl = input.sourceUrl?.trim() ?? "";

  if (!name && !rawUrl) return { ok: true, sourceName: null, sourceUrl: null };
  if (!name) return { ok: false, error: "source_name_required" };
  if (name.length < SOURCE_NAME_MIN || name.length > SOURCE_NAME_MAX) {
    return { ok: false, error: "source_name_length" };
  }

  if (!rawUrl) return { ok: true, sourceName: name, sourceUrl: null };
  const url = normalizeSourceUrl(rawUrl);
  if (!url) return { ok: false, error: "source_url_invalid" };
  return { ok: true, sourceName: name, sourceUrl: url };
}
