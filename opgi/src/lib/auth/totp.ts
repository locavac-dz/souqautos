// TOTP (RFC 6238) — second facteur par application d'authentification.
// Implémentation pure (crypto Node, sans dépendance), donc testable : HMAC‑SHA1,
// pas de 30 s, codes à 6 chiffres, fenêtre de tolérance ±1 pas par défaut.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const PAS_SECONDES = 30;
const CHIFFRES = 6;
const ALPHABET_B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // RFC 4648

/** Encode des octets en base32 (sans remplissage), pour affichage du secret. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let valeur = 0;
  let sortie = "";
  for (const o of bytes) {
    valeur = (valeur << 8) | o;
    bits += 8;
    while (bits >= 5) {
      sortie += ALPHABET_B32[(valeur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) sortie += ALPHABET_B32[(valeur << (5 - bits)) & 31];
  return sortie;
}

/** Décode une chaîne base32 (insensible à la casse, remplissage/espaces ignorés). */
export function base32Decode(s: string): Buffer {
  const nettoye = s.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = 0;
  let valeur = 0;
  const octets: number[] = [];
  for (const c of nettoye) {
    const idx = ALPHABET_B32.indexOf(c);
    if (idx === -1) throw new Error("Caractère base32 invalide.");
    valeur = (valeur << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(octets);
}

/** Génère un secret TOTP aléatoire (20 octets) en base32. */
export function genererSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Calcule le code TOTP (6 chiffres) pour un secret base32 et un instant donné. */
export function genererCode(secretBase32: string, instantMs: number = Date.now()): string {
  const compteur = Math.floor(instantMs / 1000 / PAS_SECONDES);
  return hotp(base32Decode(secretBase32), compteur);
}

function hotp(cle: Buffer, compteur: number): string {
  const buf = Buffer.alloc(8);
  // Compteur sur 64 bits big‑endian (writeBigUInt64BE pour éviter les pertes).
  buf.writeBigUInt64BE(BigInt(compteur));
  const hmac = createHmac("sha1", cle).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binaire =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (binaire % 10 ** CHIFFRES).toString().padStart(CHIFFRES, "0");
}

/**
 * Vérifie un code TOTP en tolérant une dérive d'horloge de ±`fenetre` pas.
 * Comparaison à temps constant. Rejette tout code mal formé.
 */
export function verifierCode(
  secretBase32: string,
  code: string,
  instantMs: number = Date.now(),
  fenetre = 1,
): boolean {
  const propre = (code ?? "").trim();
  if (!/^\d{6}$/.test(propre)) return false;
  const cle = base32Decode(secretBase32);
  const base = Math.floor(instantMs / 1000 / PAS_SECONDES);
  const attendu = Buffer.from(propre);
  for (let d = -fenetre; d <= fenetre; d++) {
    const candidat = Buffer.from(hotp(cle, base + d));
    if (candidat.length === attendu.length && timingSafeEqual(candidat, attendu)) return true;
  }
  return false;
}

/** Construit l'URI `otpauth://` à importer dans une application d'authentification. */
export function otpauthUri(secretBase32: string, compte: string, emetteur: string): string {
  const label = encodeURIComponent(`${emetteur}:${compte}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer: emetteur,
    algorithm: "SHA1",
    digits: String(CHIFFRES),
    period: String(PAS_SECONDES),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
