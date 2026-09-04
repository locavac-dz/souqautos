import { PrismaClient } from "@prisma/client";
import { encryptDeterministic, decryptDeterministic } from "./crypto/at-rest";

// Chiffrement au repos de User.phone (cf. docs/ARCHITECTURE.md §47), rendu
// transparent au reste de l'application via une extension Prisma plutôt que
// des appels encrypt/decrypt éparpillés dans chaque route : impossible d'en
// oublier un puisque tout passe par ce client unique. Le chiffrement est
// délibérément déterministe (cf. encryptDeterministic) pour préserver la
// contrainte @unique et les recherches par égalité (`where: { phone }`) sans
// jamais stocker le numéro en clair en base.
function encryptPhoneValue(value: unknown): unknown {
  if (typeof value === "string") return encryptDeterministic(value);
  return value;
}

function withEncryptedPhone<T extends { phone?: unknown }>(data: T): T {
  if (data && typeof data === "object" && "phone" in data) {
    return { ...data, phone: encryptPhoneValue(data.phone) };
  }
  return data;
}

function withDecryptedPhone<T>(record: T): T {
  if (record && typeof record === "object" && "phone" in (record as Record<string, unknown>)) {
    const phone = (record as Record<string, unknown>).phone;
    if (typeof phone === "string") {
      return { ...record, phone: decryptDeterministic(phone) };
    }
  }
  return record;
}

function decryptResult(result: unknown): unknown {
  if (Array.isArray(result)) return result.map((item) => withDecryptedPhone(item));
  return withDecryptedPhone(result);
}

function createPrismaClient() {
  return new PrismaClient().$extends({
    query: {
      user: {
        async $allOperations({ args, query }) {
          const a = args as { data?: Record<string, unknown>; where?: Record<string, unknown> };
          if (a.data) a.data = withEncryptedPhone(a.data);
          if (a.where && typeof a.where.phone === "string") {
            a.where = { ...a.where, phone: encryptPhoneValue(a.where.phone) };
          }
          const result = await query(args);
          return decryptResult(result);
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrismaClient> };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
