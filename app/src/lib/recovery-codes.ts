import { randomBytes } from "node:crypto";
import { keyedHash } from "@/lib/crypto/at-rest";

// Lot 138 — codes de secours de la double authentification : à utiliser UNE fois chacun si le téléphone est perdu.
//
// 12 caractères tirés parmi 32 (60 bits), affichés « ABCD-EFGH-JKLM ». L'alphabet exclut I, O, 0 et 1, qui se confondent à
// l'écriture ; 32 = 2^5 caractères, donc chaque octet aléatoire donne un caractère SANS biais (aucun tirage rejeté).
// Ce sont les seuls secrets que la personne doit garder sur papier : ils sont montrés une seule fois, et le site n'en garde
// que l'empreinte à clé (jamais le code).
export const RECOVERY_CODE_COUNT = 10;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 24 lettres (sans I ni O) + 8 chiffres (2 à 9) = 32
const CODE_LENGTH = 12;
const HASH_PURPOSE = "souqauto:2fa:recovery:v1";

export function generateRecoveryCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  const chars = Array.from(bytes, (byte) => ALPHABET[byte & 31]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((group) => group.join("")).join("-");
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(generateRecoveryCode());
  return [...codes];
}

// Ce que la personne recopie : minuscules, espaces, tirets… Douze caractères de l'alphabet exactement, sinon refusé.
export function normalizeRecoveryCode(input: string): string | null {
  const clean = input.toUpperCase().replace(/[\s-]/g, "");
  if (clean.length !== CODE_LENGTH) return null;
  for (const char of clean) if (!ALPHABET.includes(char)) return null;
  return clean;
}

// Empreinte d'un code déjà normalisé : c'est elle, jamais le code, que la base contient.
export function hashRecoveryCode(normalized: string): string {
  return keyedHash(HASH_PURPOSE, normalized);
}
