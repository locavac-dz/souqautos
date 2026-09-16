import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Hash factice (jamais un vrai mot de passe) calculé une seule fois au
// chargement du module, au même coût que hashPassword — sert uniquement à
// faire exécuter un bcrypt.compare() de durée comparable quand l'email de
// connexion n'existe pas (Lot 98, audit sécurité), pour qu'un attaquant ne
// puisse pas énumérer les comptes existants via le temps de réponse (compte
// inconnu court-circuité avant bcrypt vs compte existant qui l'attend).
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync("dummy-password-jamais-utilise", SALT_ROUNDS);
