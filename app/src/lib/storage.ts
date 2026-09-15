import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Client S3 partagé (stockage des photos — cf. src/lib/uploads.ts), même
// patron que le client Redis unique (src/lib/redis.ts) : réutilisé via
// `globalThis` pour ne jamais recréer de connexion à chaque rechargement à
// chaud en dev. `null` tant que S3_BUCKET n'est pas configurée — chaque
// appelant garde alors son repli disque local existant, comportement
// strictement inchangé (docs/ARCHITECTURE.md §6 : stockage compatible S3
// prévu "MinIO auto-hébergé ou fournisseur DZ/régional", jamais une
// dépendance obligatoire du MVP).
const globalForStorage = globalThis as unknown as { s3Client?: S3Client | null };

function createClient(): S3Client | null {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) return null;

  const hasCredentials = process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY;

  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    // Sans identifiants explicites, laisse le SDK résoudre via sa propre
    // chaîne par défaut (rôle IAM, variables AWS_* standard) plutôt que de
    // forcer des identifiants vides — comportement SDK normal, pas un repli
    // de ce projet.
    credentials: hasCredentials
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! }
      : undefined,
    // Requis par MinIO et la plupart des fournisseurs S3-compatibles hors
    // AWS lui-même (cible réelle de ce projet, cf. §6 ci-dessus).
    forcePathStyle: true,
  });
}

export function getS3Client(): S3Client | null {
  if (globalForStorage.s3Client === undefined) {
    globalForStorage.s3Client = createClient();
  }
  return globalForStorage.s3Client;
}

export function isS3Configured(): boolean {
  return getS3Client() !== null;
}

function publicUrlBase(): string {
  return (process.env.S3_PUBLIC_URL ?? "").replace(/\/$/, "");
}

export function buildPublicUrl(key: string): string {
  return `${publicUrlBase()}/${key}`;
}

// Clé S3 si storedPath est une URL sous S3_PUBLIC_URL, sinon `null` — lit
// S3_PUBLIC_URL directement (jamais isS3Configured()) : doit rester correct
// même si une ancienne ligne S3 existe alors que S3 est désormais désactivé
// (parc mixte pendant une transition), cf. deleteStoredFile dans uploads.ts.
export function s3KeyFromStoredPath(storedPath: string): string | null {
  const base = publicUrlBase();
  return base && storedPath.startsWith(`${base}/`) ? storedPath.slice(base.length + 1) : null;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const client = getS3Client();
  if (!client) throw new Error("s3_not_configured");
  await client.send(
    new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: body, ContentType: contentType })
  );
}

export async function deleteObject(key: string): Promise<void> {
  const client = getS3Client();
  if (!client) return;
  await client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
}
