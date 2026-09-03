import crypto from "crypto";

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() > expiresAt.getTime();
}

export function generateExpiry(minutesFromNow: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + minutesFromNow * 60 * 1000);
}

export function generateNumericCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += crypto.randomInt(0, 10).toString();
  }
  return code;
}

const MAX_PHONE_ATTEMPTS = 5;

export type PhoneCodeCheck =
  | { ok: true }
  | { ok: false; error: "expired" | "invalid_code" | "too_many_attempts" };

// L'ordre des vérifications compte : un code expiré ou déjà trop essayé ne
// doit jamais être révélé comme simplement "invalide" (fuiterait l'info sur
// l'état du compteur), donc ces cas sont testés avant la comparaison du code.
export function checkPhoneCode({
  submittedCode,
  storedCode,
  expiresAt,
  attempts,
  now = new Date(),
}: {
  submittedCode: string;
  storedCode: string;
  expiresAt: Date;
  attempts: number;
  now?: Date;
}): PhoneCodeCheck {
  if (attempts >= MAX_PHONE_ATTEMPTS) {
    return { ok: false, error: "too_many_attempts" };
  }
  if (isExpired(expiresAt, now)) {
    return { ok: false, error: "expired" };
  }
  if (submittedCode !== storedCode) {
    return { ok: false, error: "invalid_code" };
  }
  return { ok: true };
}
