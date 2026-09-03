import { randomUUID } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 Mo
const MAX_WIDTH = 1600;

// Stocké HORS de /public : ces documents contiennent des données personnelles
// sensibles (pièce d'identité) et ne doivent jamais être accessibles par une
// URL publique directe — uniquement via une route API authentifiée réservée
// au staff (/api/admin/identity-requests/[id]/document).
const UPLOAD_DIR = path.join(process.cwd(), "private-uploads", "identity");

export class DocumentValidationError extends Error {}

// Ne jamais se fier au nom/type déclaré par le client : on lit les octets réels.
export async function saveIdentityDocument(file: File): Promise<{ filename: string; mime: string }> {
  if (file.size > MAX_BYTES) {
    throw new DocumentValidationError("document_too_large");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected || !ALLOWED_MIME.has(detected.mime)) {
    throw new DocumentValidationError("document_invalid_type");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  if (detected.mime === "application/pdf") {
    const filename = `${randomUUID()}.pdf`;
    const fs = await import("node:fs/promises");
    await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
    return { filename, mime: "application/pdf" };
  }

  const filename = `${randomUUID()}.jpg`;
  await sharp(buffer)
    .rotate() // applique l'orientation EXIF puis la retire
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(path.join(UPLOAD_DIR, filename));

  return { filename, mime: "image/jpeg" };
}

export function identityDocumentAbsolutePath(filename: string): string {
  return path.join(UPLOAD_DIR, filename);
}

// Supprimé du disque une fois la décision de review prise (approuvée ou
// refusée) — aucune conservation indéfinie d'une pièce d'identité.
export async function deleteIdentityDocument(filename: string): Promise<void> {
  await unlink(identityDocumentAbsolutePath(filename)).catch(() => {});
}
