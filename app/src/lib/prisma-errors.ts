import { Prisma } from "@prisma/client";

// Violation d'une contrainte d'unicité (code Prisma P2002). Les routes qui
// « vérifient puis créent » ont toujours une fenêtre de concurrence entre la
// vérification et l'écriture (double clic, deux requêtes simultanées) : la base
// reste l'arbitre, et cette erreur doit devenir la même réponse propre que la
// vérification (409/400), jamais un 500.
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
