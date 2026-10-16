// Stockage local des pièces jointes. La clé est OPAQUE et préfixée par
// l'organisme (« <organisationId>/<uuid> ») ; les fichiers vivent sous un
// répertoire de base configurable, hors de l'arborescence servie publiquement.
// Aucun accès direct : la lecture passe toujours par un handler autorisé.
//
// Interface volontairement minimale (put/get/remove) pour pouvoir basculer vers
// un stockage objet (S3) en production sans changer les appelants.
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

export function nouvelleCle(organisationId: string): string {
  return `${organisationId}/${randomUUID()}`;
}

/** Résout une clé en chemin absolu SOUS baseDir (anti path‑traversal). */
function cheminDe(baseDir: string, cle: string): string {
  const base = resolve(baseDir);
  const p = resolve(base, cle);
  if (p !== base && !p.startsWith(base + sep)) {
    throw new Error("Clé de stockage invalide.");
  }
  return p;
}

export async function putObject(baseDir: string, cle: string, data: Buffer): Promise<void> {
  const p = cheminDe(baseDir, cle);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, data);
}

export async function getObject(baseDir: string, cle: string): Promise<Buffer> {
  return readFile(cheminDe(baseDir, cle));
}

export async function removeObject(baseDir: string, cle: string): Promise<void> {
  await unlink(cheminDe(baseDir, cle)).catch(() => undefined);
}

export function joinBase(baseDir: string, cle: string): string {
  return join(baseDir, cle);
}
