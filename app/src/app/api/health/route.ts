import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis";
import { apiHandler } from "@/lib/api-route";

// Lot 117 — point de contrôle pour la supervision (moniteur de disponibilité,
// répartiteur de charge, orchestrateur). 200 si l'application répond ET que ses
// dépendances vitales répondent, 503 sinon. Ne renvoie AUCUNE information
// sensible : ni version, ni configuration, ni message d'erreur détaillé (ils
// restent dans les journaux du serveur).
export const dynamic = "force-dynamic";

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export const GET = apiHandler(async () => {
  const checks: Record<string, "ok" | "error" | "absent"> = {};

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 3000);
    checks.database = "ok";
  } catch (error) {
    console.error(`[health] base de données : ${(error as Error).message}`);
    checks.database = "error";
  }

  const redis = getRedisClient();
  if (!redis) {
    checks.redis = "absent";
  } else {
    try {
      await withTimeout(redis.ping(), 2000);
      checks.redis = "ok";
    } catch (error) {
      // Redis n'est pas vital : l'application retombe sur des limites en mémoire
      // (cf. rate-limit.ts). On le signale sans faire échouer le contrôle.
      console.error(`[health] redis : ${(error as Error).message}`);
      checks.redis = "error";
    }
  }

  const healthy = checks.database === "ok";
  return NextResponse.json({ status: healthy ? "ok" : "degraded", checks }, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
});
