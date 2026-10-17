// Hachage et vérification de mot de passe (bcrypt).
import bcrypt from "bcryptjs";

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

/** Vérifie un mot de passe ; renvoie false (jamais une erreur) si aucun hash. */
export async function verifyPassword(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) {
    // Comparaison factice pour limiter l'oracle temporel sur l'existence du compte.
    await bcrypt.compare(plain, "$2a$12$0000000000000000000000000000000000000000000000000000");
    return false;
  }
  return bcrypt.compare(plain, hash);
}
