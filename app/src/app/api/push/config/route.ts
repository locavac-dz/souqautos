import { NextResponse } from "next/server";
import { resolvePushConfig } from "@/lib/push";

// Lot 121 — dit au navigateur si les notifications sont disponibles et lui donne la clé PUBLIQUE
// du site (nécessaire pour s'abonner). La clé privée ne quitte jamais le serveur.
export const dynamic = "force-dynamic";

export async function GET() {
  const config = resolvePushConfig(process.env);
  return NextResponse.json(
    config.mode === "enabled" ? { enabled: true, publicKey: config.publicKey } : { enabled: false },
    { headers: { "Cache-Control": "no-store" } }
  );
}
