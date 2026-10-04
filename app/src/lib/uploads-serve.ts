import path from "node:path";

// Lot 147 — service des photos envoyées (`/uploads/...`) par l'application elle-même.
//
// LE DÉFAUT QUE CE MODULE CORRIGE : le site écrit chaque photo envoyée dans `public/uploads/`, et comptait sur Next.js pour la servir.
// Or la version de PRODUCTION ne sert que les fichiers de `public/` qui EXISTAIENT AU DÉMARRAGE : une photo envoyée ensuite répondait 404
// jusqu'au redémarrage suivant, et l'optimiseur d'images (qui la relit par le même chemin) répondait 400. Sur un vrai serveur, chaque
// photo d'annonce aurait été cassée. Le serveur de développement, lui, sert les fichiers à la volée : aucun test de bout en bout ne le voyait.
//
// Ce module décide QUEL fichier une adresse peut désigner ; la route `src/app/uploads/[...path]/route.ts` le lit et le sert. Il est volontairement
// AUSSI ÉTROIT que ce que le site écrit : mêmes dossiers que `storeProcessedImage` (src/lib/uploads.ts), jamais autre chose.

// Les dossiers où le site écrit (src/lib/uploads.ts) : rien d'autre n'est servi.
export const UPLOAD_SUBDIRS = ["listings", "avatars", "messages", "pro-logos", "pro-banners", "blog-covers", "voice-messages"] as const;

// Le site n'écrit que du JPEG (sharp) pour les images, mais des fichiers de démonstration ou anciens peuvent porter une autre extension.
// Lot 251 : extensions audio pour les messages vocaux.
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".mp4": "audio/mp4",
};

export function uploadsRoot(): string {
  return path.join(process.cwd(), "public", "uploads");
}

// Un segment d'adresse sûr : commence par une lettre ou un chiffre (donc ni « .. » ni fichier caché), ne contient que des caractères
// de nom de fichier ordinaires, jamais de séparateur, de « % », de deux-points ni d'octet nul.
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/;

export type UploadTarget = { file: string; contentType: string };

// Résout les segments d'une adresse `/uploads/<dossier>/<fichier>` vers un fichier du dossier des envois, ou `null` — sans jamais dire
// pourquoi. Pur : ne touche pas au disque (la route vérifie ensuite que le fichier existe et n'est pas un lien qui sort du dossier).
export function resolveUploadFile(root: string, segments: readonly string[]): UploadTarget | null {
  if (segments.length !== 2) return null; // toujours <dossier>/<fichier> : pas de sous-dossier libre
  const [subdir, name] = segments;
  if (!(UPLOAD_SUBDIRS as readonly string[]).includes(subdir)) return null;
  if (!SAFE_SEGMENT.test(name) || name.includes("..")) return null;

  const contentType = CONTENT_TYPES[path.extname(name).toLowerCase()];
  if (!contentType) return null;

  const file = path.resolve(root, subdir, name);
  const base = path.resolve(root, subdir) + path.sep;
  return file.startsWith(base) ? { file, contentType } : null;
}

// Empreinte de validation pour le cache du navigateur : taille et date de modification. Un nom de fichier n'est jamais réutilisé (UUID),
// donc l'empreinte ne change pas en pratique — elle sert à répondre 304 quand le navigateur redemande une photo qu'il garde déjà.
export function uploadEtag(size: number, mtimeMs: number): string {
  return `"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}"`;
}
