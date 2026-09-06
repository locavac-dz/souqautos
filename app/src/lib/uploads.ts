import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 Mo
const MAX_PHOTO_WIDTH = 1600;
const MAX_AVATAR_BYTES = 4 * 1024 * 1024; // 4 Mo
const AVATAR_SIZE = 400;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 Mo

const LISTING_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "listings");
const AVATAR_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const MESSAGE_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "messages");

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

export type SavedPhoto = { path: string; sha256: string };

// Lot 77 — l'empreinte porte sur les octets réellement stockés (après le
// pipeline sharp déterministe), pas sur le fichier brut envoyé par le client :
// deux uploads du même fichier source produisent alors la même empreinte
// finale, permettant de repérer une photo strictement identique réutilisée
// par un AUTRE vendeur (signal anti-fraude, cf. src/lib/fraud-signals.ts).
export async function savePhoto(file: File): Promise<SavedPhoto> {
  const buffer = await readValidatedImage(file, MAX_PHOTO_BYTES);

  await mkdir(LISTING_UPLOAD_DIR, { recursive: true });

  const filename = `${randomUUID()}.jpg`;
  const outputPath = path.join(LISTING_UPLOAD_DIR, filename);

  const output = await sharp(buffer)
    .rotate() // applique l'orientation EXIF puis la retire
    .resize({ width: MAX_PHOTO_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  await writeFile(outputPath, output);
  const sha256 = createHash("sha256").update(output).digest("hex");

  return { path: `/uploads/listings/${filename}`, sha256 };
}

// Lot 34 — avatar de profil : mêmes règles de sécurité que savePhoto (octets
// réels, nom physique généré), taille plus petite et cadrage carré adapté à
// un avatar plutôt qu'une photo d'annonce.
export async function saveAvatar(file: File): Promise<string> {
  const buffer = await readValidatedImage(file, MAX_AVATAR_BYTES);

  await mkdir(AVATAR_UPLOAD_DIR, { recursive: true });

  const filename = `${randomUUID()}.jpg`;
  const outputPath = path.join(AVATAR_UPLOAD_DIR, filename);

  await sharp(buffer)
    .rotate()
    .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE, fit: "cover" })
    .jpeg({ quality: 85 })
    .toFile(outputPath);

  return `/uploads/avatars/${filename}`;
}

// Lot 39 — pièce jointe image en messagerie : mêmes règles de sécurité que
// savePhoto/saveAvatar (octets réels, nom physique généré), limite propre
// (5 Mo) et même largeur max qu'une photo d'annonce, sans cadrage carré.
export async function saveMessageAttachment(file: File): Promise<string> {
  const buffer = await readValidatedImage(file, MAX_ATTACHMENT_BYTES);

  await mkdir(MESSAGE_UPLOAD_DIR, { recursive: true });

  const filename = `${randomUUID()}.jpg`;
  const outputPath = path.join(MESSAGE_UPLOAD_DIR, filename);

  await sharp(buffer)
    .rotate()
    .resize({ width: MAX_PHOTO_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(outputPath);

  return `/uploads/messages/${filename}`;
}
