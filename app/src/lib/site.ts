export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:5184").replace(
  /\/$/,
  ""
);

// Construit une URL absolue à partir d'un chemin de photo stocké — celui-ci
// est soit déjà une URL absolue (stockage S3, cf. src/lib/uploads.ts), soit
// un chemin relatif local ("/uploads/..."), jamais mélangé au préfixe
// SITE_URL par erreur (ce qui produirait "https://site.comhttps://bucket...").
export function resolveAbsolutePhotoUrl(storedPath: string): string {
  return storedPath.startsWith("http") ? storedPath : `${SITE_URL}${storedPath}`;
}
