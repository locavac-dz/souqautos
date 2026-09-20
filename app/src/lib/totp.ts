import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Lot 138 — mot de passe à usage unique basé sur le temps (TOTP, RFC 6238, sur HOTP RFC 4226), pour la double
// authentification par application (Google Authenticator, Microsoft Authenticator, Aegis, FreeOTP, 2FAS…).
// Écrit avec le seul module `crypto` de Node : aucune dépendance de plus pour ce qui protège les comptes de l'équipe.
//
// Paramètres : HMAC-SHA1, 6 chiffres, pas de 30 secondes — les valeurs que TOUTES les applications supposent (le seul
// paramètre qu'une application ignorerait, c'est un autre algorithme : rester sur SHA-1, sûr ici car HMAC).
// Module pur (aucune base, aucune horloge cachée : l'heure est passée en paramètre) : testé contre les vecteurs de la RFC.

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
// ±1 pas : tolère une horloge de téléphone en avance ou en retard de 30 secondes, sans ouvrir plus de trois codes valides.
export const TOTP_WINDOW = 1;
const SECRET_BYTES = 20; // 160 bits, la taille recommandée pour HMAC-SHA1

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

// Tolérant à la façon dont on recopie une clé à la main : minuscules, espaces, tirets, « = » de fin. Refuse tout le reste.
export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  if (!clean || /[^A-Z2-7]/.test(clean)) throw new Error("Clé de double authentification invalide.");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    value = (value << 5) | B32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES));
}

// HOTP (RFC 4226) : HMAC-SHA1 du compteur sur 8 octets, troncature dynamique.
export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function stepAt(nowMs: number): number {
  return Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
}

export function totpCode(secretBase32: string, nowMs: number, digits = TOTP_DIGITS): string {
  return hotp(base32Decode(secretBase32), stepAt(nowMs), digits);
}

// Ce que la personne recopie : « 123 456 », « 123-456 »… Six chiffres exactement, sinon refusé (jamais deviné).
export function normalizeTotpInput(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

export type TotpVerification = { ok: true; step: number } | { ok: false };

// Un code est accepté s'il correspond à l'un des pas de la fenêtre ET si ce pas est POSTÉRIEUR au dernier pas déjà accepté :
// un code observé (épaule, copie, réseau) ne peut donc pas être rejoué dans sa minute de validité. Le pas est rendu à
// l'appelant, qui doit le MÉMORISER de façon atomique (sinon deux requêtes simultanées rejoueraient le même code).
export function verifyTotp(secretBase32: string, input: string, options: { nowMs: number; lastStep: number | null; window?: number }): TotpVerification {
  const code = normalizeTotpInput(input);
  if (!code) return { ok: false };
  let secret: Buffer;
  try {
    secret = base32Decode(secretBase32);
  } catch {
    return { ok: false };
  }
  const current = stepAt(options.nowMs);
  const window = options.window ?? TOTP_WINDOW;
  const given = Buffer.from(code);
  let accepted: number | null = null;
  // Toutes les valeurs de la fenêtre sont calculées et comparées, même après une correspondance : la durée ne dit rien du pas trouvé.
  for (let offset = -window; offset <= window; offset++) {
    const step = current + offset;
    if (step < 0) continue;
    const expected = Buffer.from(hotp(secret, step));
    const matches = timingSafeEqual(given, expected);
    if (matches && (options.lastStep === null || step > options.lastStep) && accepted === null) accepted = step;
  }
  return accepted === null ? { ok: false } : { ok: true, step: accepted };
}

// Adresse « otpauth:// » que lit l'application (par le code QR ou un lien). L'émetteur et le compte s'affichent dans l'application.
export function otpauthUri({ issuer, account, secret }: { issuer: string; account: string; secret: string }): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(TOTP_DIGITS), period: String(TOTP_STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// Clé à recopier à la main, par groupes de quatre : « ABCD EFGH … » (les applications acceptent les espaces).
export function formatSecretForDisplay(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
