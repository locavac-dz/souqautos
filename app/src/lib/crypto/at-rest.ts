import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

// Chiffrement au repos (téléphone utilisateur, documents de vérification
// d'identité — cf. docs/ARCHITECTURE.md §47). Clé maîtresse dans ENCRYPTION_KEY
// (32 octets encodés en base64) ; des sous-clés distinctes sont dérivées par
// HMAC-SHA256 pour chaque usage plutôt que de réutiliser la clé maîtresse
// directement. Limite de bootstrap assumée : la clé reste en clair dans .env,
// comme JWT_SECRET — aucun coffre-fort externe (Vault/KMS) en place à ce jour.

function masterKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY manquante");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY doit décoder en 32 octets (base64)");
  return key;
}

function deriveKey(purpose: string): Buffer {
  return createHmac("sha256", masterKey()).update(purpose).digest();
}

const DETERMINISTIC_ENC_KEY_INFO = "souqauto:at-rest:enc:deterministic:v1";
const DETERMINISTIC_IV_KEY_INFO = "souqauto:at-rest:iv:v1";
const RANDOM_ENC_KEY_INFO = "souqauto:at-rest:enc:random:v1";

/**
 * Chiffrement déterministe : l'IV est dérivé du texte en clair (HMAC avec une
 * sous-clé dédiée), jamais tiré au hasard. Un même texte en clair produit donc
 * toujours le même chiffré — propriété nécessaire pour préserver une
 * contrainte @unique et les recherches d'égalité en base (ex: User.phone) sans
 * stocker le texte en clair. Ne jamais utiliser pour un contenu où deux
 * valeurs identiques ne doivent pas être distinguables (cf. encryptBuffer).
 */
export function encryptDeterministic(plaintext: string): string {
  const encKey = deriveKey(DETERMINISTIC_ENC_KEY_INFO);
  const ivKey = deriveKey(DETERMINISTIC_IV_KEY_INFO);
  const iv = createHmac("sha256", ivKey).update(plaintext, "utf8").digest().subarray(0, 12);
  const cipher = createCipheriv("aes-256-gcm", encKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptDeterministic(encoded: string): string {
  const encKey = deriveKey(DETERMINISTIC_ENC_KEY_INFO);
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Chiffrement aléatoire : IV tiré au hasard à chaque appel, donc deux
 * chiffrements du même contenu produisent des sorties différentes. C'est la
 * propriété recherchée pour un fichier (document de vérification d'identité) :
 * aucune contrainte d'unicité ni recherche par égalité dessus.
 */
export function encryptBuffer(plaintext: Buffer): Buffer {
  const encKey = deriveKey(RANDOM_ENC_KEY_INFO);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptBuffer(encoded: Buffer): Buffer {
  const encKey = deriveKey(RANDOM_ENC_KEY_INFO);
  const iv = encoded.subarray(0, 12);
  const authTag = encoded.subarray(12, 28);
  const ciphertext = encoded.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Empreinte À CLÉ (HMAC-SHA256, clé dérivée de la clé maîtresse pour un usage donné), en hexadécimal. Sert à stocker une valeur
 * qu'on ne doit jamais pouvoir relire mais seulement COMPARER (codes de secours de la double authentification, Lot 138).
 * Contrairement à un SHA-256 seul, une copie de la base ne permet pas de retrouver la valeur par force brute hors ligne :
 * il faudrait aussi la clé du serveur.
 */
export function keyedHash(purpose: string, value: string): string {
  return createHmac("sha256", deriveKey(purpose)).update(value, "utf8").digest("hex");
}
