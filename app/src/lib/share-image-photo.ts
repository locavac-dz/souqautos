import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { s3KeyFromStoredPath } from "@/lib/storage";

// Lot 142 — charge la première photo d'une annonce et la recadre aux dimensions exactes de la carte de partage (1200 × 630, ratio
// attendu par WhatsApp/Facebook), en JPEG. Renvoie `null` au moindre doute : la carte se dessine alors sans photo, elle n'échoue pas.
//
// SÉCURITÉ — la valeur lue vient de la base, mais on ne lui fait pas confiance pour autant :
//  - chemin local : doit commencer par « /uploads/ » et, une fois résolu, rester DANS le dossier des envois (aucune remontée « .. ») ;
//  - URL distante : n'est suivie que si elle est sous S3_PUBLIC_URL (notre propre stockage). Toute autre adresse est refusée, pour
//    qu'un chemin détourné ne fasse jamais appeler un serveur interne ou tiers depuis le nôtre (SSRF) ;
//  - taille et durée bornées : une photo anormale ou un stockage lent ne bloque pas la génération.

export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 630;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 3000;

// Le dossier des envois locaux est injectable pour les tests ; par défaut, celui que remplit src/lib/uploads.ts.
export function defaultUploadsRoot(): string {
  return path.join(process.cwd(), "public", "uploads");
}

async function readStoredBytes(storedPath: string, uploadsRoot: string): Promise<Buffer | null> {
  if (storedPath.startsWith("/uploads/")) {
    const resolved = path.resolve(uploadsRoot, storedPath.slice("/uploads/".length));
    const root = path.resolve(uploadsRoot);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) return null; // sortie du dossier : refusé
    return readFile(resolved);
  }

  if (s3KeyFromStoredPath(storedPath) === null) return null; // ni local, ni sous notre stockage : refusé
  const response = await fetch(storedPath, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: "error" });
  if (!response.ok) return null;
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_PHOTO_BYTES) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  return bytes.length > MAX_PHOTO_BYTES ? null : bytes;
}

export async function loadSharePhoto(storedPath: string | null | undefined, uploadsRoot: string = defaultUploadsRoot()): Promise<Buffer | null> {
  if (!storedPath) return null;
  try {
    const bytes = await readStoredBytes(storedPath, uploadsRoot);
    if (!bytes) return null;
    // Les octets sont ré-encodés par sharp : ce qui n'est pas une vraie image (ou une image piégée) échoue ici et donne `null`.
    return await sharp(bytes).rotate().resize(SHARE_WIDTH, SHARE_HEIGHT, { fit: "cover", position: "centre" }).jpeg({ quality: 82 }).toBuffer();
  } catch {
    return null;
  }
}
