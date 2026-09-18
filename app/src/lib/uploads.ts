import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { analyzePhotoQuality, type PhotoQualityFlag } from "@/lib/photo-quality";
import { isS3Configured, putObject, s3KeyFromStoredPath, buildPublicUrl, deleteObject } from "@/lib/storage";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 Mo
const MAX_PHOTO_WIDTH = 1600;
const MAX_AVATAR_BYTES = 4 * 1024 * 1024; // 4 Mo
const AVATAR_SIZE = 400;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 Mo
const MAX_LOGO_BYTES = 4 * 1024 * 1024; // 4 Mo
const LOGO_SIZE = 400;
const MAX_BANNER_BYTES = 8 * 1024 * 1024; // 8 Mo
const BANNER_WIDTH = 1600;
const BANNER_HEIGHT = 400;

export class PhotoValidationError extends Error {}

// Ne jamais se fier au nom/type déclaré par le client : on lit les octets réels
// (cf. incident Al Handassa Urban — jamais file.filename dans un chemin de
// stockage, toujours un nom physique généré).
async function readValidatedImage(file: File, maxBytes: number): Promise<Buffer> {
  if (file.size > maxBytes) {
    throw new PhotoValidationError("photo_too_large");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected || !ALLOWED_MIME.has(detected.mime)) {
    throw new PhotoValidationError("photo_invalid_type");
  }

  return buffer;
}

// Point d'écriture unique pour les trois types de photo publiques ci-dessous
// ET pour le seed de démonstration (prisma/seed-demo-listings.ts) — S3 quand
// configuré (docs/ARCHITECTURE.md §6), repli disque local sinon, comportement
// strictement inchangé par rapport à avant ce lot. Le repli reste aussi actif
// si S3 devient injoignable au moment précis de l'upload : un problème
// d'infrastructure annexe ne doit jamais empêcher un vendeur de publier sa
// photo, seulement lui faire perdre le partage entre instances pour CETTE
// photo précise, jusqu'au prochain upload réussi vers S3.
export async function storeProcessedImage(
  subdir: "listings" | "avatars" | "messages" | "pro-logos" | "pro-banners",
  filename: string,
  bytes: Buffer
): Promise<string> {
  const key = `${subdir}/${filename}`;

  if (isS3Configured()) {
    try {
      await putObject(key, bytes, "image/jpeg");
      return buildPublicUrl(key);
    } catch (err) {
      console.error(`[uploads] S3 indisponible, repli disque local: ${(err as Error).message}`);
    }
  }

  const dir = path.join(process.cwd(), "public", "uploads", subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), bytes);
  return `/uploads/${subdir}/${filename}`;
}

// Supprime un fichier précédemment stocké par storeProcessedImage, qu'il
// soit sur S3 (URL absolue sous S3_PUBLIC_URL) ou sur disque local (chemin
// relatif) — détecté depuis la FORME de storedPath, jamais depuis l'état
// actuel de la configuration S3 : une ancienne ligne S3 doit rester
// supprimable même si S3 a depuis été désactivé, et inversement. Jamais
// bloquant pour l'appelant (même discipline que l'envoi d'un email qui
// échoue déjà sans jamais faire échouer l'action principale) : un fichier
// orphelin non supprimé est un défaut mineur, jamais une raison de faire
// échouer une mutation déjà appliquée en base.
export async function deleteStoredFile(storedPath: string): Promise<void> {
  try {
    const key = s3KeyFromStoredPath(storedPath);
    if (key) {
      await deleteObject(key);
      return;
    }
    if (storedPath.startsWith("/uploads/")) {
      await unlink(path.join(process.cwd(), "public", storedPath));
    }
  } catch {
    // volontairement silencieux au-delà du log interne de deleteObject —
    // jamais une exception qui remonterait jusqu'à l'appelant.
  }
}

export type SavedPhoto = { path: string; sha256: string; qualityFlags: PhotoQualityFlag[] };

// Lot 77 — l'empreinte porte sur les octets réellement stockés (après le
// pipeline sharp déterministe), pas sur le fichier brut envoyé par le client :
// deux uploads du même fichier source produisent alors la même empreinte
// finale, permettant de repérer une photo strictement identique réutilisée
// par un AUTRE vendeur (signal anti-fraude, cf. src/lib/fraud-signals.ts).
export async function savePhoto(file: File): Promise<SavedPhoto> {
  const buffer = await readValidatedImage(file, MAX_PHOTO_BYTES);

  const output = await sharp(buffer)
    .rotate() // applique l'orientation EXIF puis la retire
    .resize({ width: MAX_PHOTO_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  const filename = `${randomUUID()}.jpg`;
  const storedPath = await storeProcessedImage("listings", filename, output);
  const sha256 = createHash("sha256").update(output).digest("hex");
  const qualityFlags = await analyzePhotoQuality(output);

  return { path: storedPath, sha256, qualityFlags };
}

// Lot 34 — avatar de profil : mêmes règles de sécurité que savePhoto (octets
// réels, nom physique généré), taille plus petite et cadrage carré adapté à
// un avatar plutôt qu'une photo d'annonce.
export async function saveAvatar(file: File): Promise<string> {
  const buffer = await readValidatedImage(file, MAX_AVATAR_BYTES);

  const output = await sharp(buffer)
    .rotate()
    .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE, fit: "cover" })
    .jpeg({ quality: 85 })
    .toBuffer();

  const filename = `${randomUUID()}.jpg`;
  return storeProcessedImage("avatars", filename, output);
}

// Lot 39 — pièce jointe image en messagerie : mêmes règles de sécurité que
// savePhoto/saveAvatar (octets réels, nom physique généré), limite propre
// (5 Mo) et même largeur max qu'une photo d'annonce, sans cadrage carré.
export async function saveMessageAttachment(file: File): Promise<string> {
  const buffer = await readValidatedImage(file, MAX_ATTACHMENT_BYTES);

  const output = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_PHOTO_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  const filename = `${randomUUID()}.jpg`;
  return storeProcessedImage("messages", filename, output);
}

// Lot 103 — logo de compte professionnel (concessionnaire/garage/showroom) :
// mêmes règles de sécurité que saveAvatar, cadrage carré identique (un logo
// se présente comme un avatar, pas comme une photo d'annonce).
export async function saveProLogo(file: File): Promise<string> {
  const buffer = await readValidatedImage(file, MAX_LOGO_BYTES);

  const output = await sharp(buffer)
    .rotate()
    .resize({ width: LOGO_SIZE, height: LOGO_SIZE, fit: "cover" })
    .jpeg({ quality: 85 })
    .toBuffer();

  const filename = `${randomUUID()}.jpg`;
  return storeProcessedImage("pro-logos", filename, output);
}

// Lot 103 — bannière de compte professionnel : cadrage large fixe (format
// bandeau) plutôt que le simple plafond de largeur d'une photo d'annonce, pour
// un rendu cohérent en haut de la boutique publique quelle que soit la photo
// source envoyée par le vendeur.
export async function saveProBanner(file: File): Promise<string> {
  const buffer = await readValidatedImage(file, MAX_BANNER_BYTES);

  const output = await sharp(buffer)
    .rotate()
    .resize({ width: BANNER_WIDTH, height: BANNER_HEIGHT, fit: "cover" })
    .jpeg({ quality: 85 })
    .toBuffer();

  const filename = `${randomUUID()}.jpg`;
  return storeProcessedImage("pro-banners", filename, output);
}
