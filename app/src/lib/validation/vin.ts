import { z } from "zod";

const VIN_LENGTH = 17;
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4,
  "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
};

const POSITION_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export function isValidVin(raw: string): boolean {
  const vin = raw.toUpperCase();
  if (vin.length !== VIN_LENGTH) return false;
  if (!VIN_REGEX.test(vin)) return false;

  let sum = 0;
  for (let i = 0; i < VIN_LENGTH; i++) {
    const value = TRANSLITERATION[vin[i]];
    if (value === undefined) return false;
    sum += value * POSITION_WEIGHTS[i];
  }

  const remainder = sum % 11;
  const checkChar = remainder === 10 ? "X" : String(remainder);
  return vin[8] === checkChar;
}

export function normalizeVin(raw: string): string {
  return raw.toUpperCase().replace(/\s/g, "");
}

export const vinField = z
  .string()
  .trim()
  .transform((v) => normalizeVin(v))
  .refine((v) => v.length === 0 || isValidVin(v), { message: "VIN invalide" })
  .optional();
