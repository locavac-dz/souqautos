import { prisma } from "@/lib/prisma";

// Aucun planificateur (cron/queue) n'existe dans cette application — l'expiration
// est donc appliquée paresseusement : on bascule les annonces dépassées vers
// EXPIREE juste avant les lectures à fort trafic (recherche, détail d'annonce,
// mes-annonces) plutôt que sur un job périodique. Un balayage global (pas
// filtré à la page courante) suffit à maintenir la base cohérente tant qu'au
// moins une de ces pages est visitée régulièrement.
export async function sweepExpiredListings(now: Date = new Date()): Promise<void> {
  await prisma.listing.updateMany({
    where: { status: "PUBLIEE", expiresAt: { lt: now } },
    data: { status: "EXPIREE" },
  });
}
