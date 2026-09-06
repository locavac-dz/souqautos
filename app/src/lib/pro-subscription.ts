import type { ListingStatus, ProSubscriptionTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Lot 79 — abonnements professionnels (§4-B/§11 du cahier d'architecture).
// Quotas/prix en dur pour l'instant, pas encore configurables en back-office
// — même choix assumé que PREMIUM_VALIDITY_DAYS (src/lib/payment-orders.ts) :
// une valeur fonctionnelle d'abord, éditable plus tard si le besoin apparaît
// (cf. AUTO_SUSPEND_*_THRESHOLD codé en dur au Lot 21, configurable au Lot 47).
export const SUBSCRIPTION_QUOTAS: Record<ProSubscriptionTier, number | null> = {
  STARTER: 5,
  BUSINESS: 20,
  PRO: 60,
  PREMIUM: null, // illimité
};

// STARTER est le palier gratuit par défaut — jamais un prix pour lui.
export const SUBSCRIPTION_PRICES_DZD: Record<"BUSINESS" | "PRO" | "PREMIUM", number> = {
  BUSINESS: 3000,
  PRO: 6000,
  PREMIUM: 12000,
};

// Même règle que la validité prolongée des formules d'annonce (Lot 66) : un
// abonnement payant dure 30 jours, renouvelable par un nouveau virement.
export const SUBSCRIPTION_VALIDITY_DAYS = 30;

// Jamais déduit du tri alphabétique de l'énumération (BUSINESS < PREMIUM <
// PRO < STARTER alphabétiquement, ce qui ne correspond à rien) — même piège
// que FORMULA_RANK (src/lib/payment-orders.ts).
const TIER_RANK: Record<ProSubscriptionTier, number> = {
  STARTER: 0,
  BUSINESS: 1,
  PRO: 2,
  PREMIUM: 3,
};

export function tierRank(tier: ProSubscriptionTier): number {
  return TIER_RANK[tier];
}

export function priceForTier(tier: "BUSINESS" | "PRO" | "PREMIUM"): number {
  return SUBSCRIPTION_PRICES_DZD[tier];
}

// Variante utilisée par la page publique /professionnels (Lot 80), qui doit
// afficher les 4 paliers y compris STARTER (gratuit, donc `null`).
export function priceForAnyTier(tier: ProSubscriptionTier): number | null {
  return tier === "STARTER" ? null : SUBSCRIPTION_PRICES_DZD[tier];
}

export function quotaForTier(tier: ProSubscriptionTier): number | null {
  return SUBSCRIPTION_QUOTAS[tier];
}

// Statuts qui "occupent" une place dans le quota — jamais REFUSEE (jamais
// entrée dans le stock actif), VENDUE ou EXPIREE (annonces closes, ne
// bloquent pas de nouvelles publications). BROUILLON compte : un brouillon
// deviendra une vraie annonce dès qu'il sera complété, il occupe déjà
// nominalement une place dans le stock du compte pro.
export const QUOTA_COUNTED_STATUSES: ListingStatus[] = ["BROUILLON", "EN_ATTENTE", "PUBLIEE", "SUSPENDUE"];

export function isWithinQuota(activeListingCount: number, tier: ProSubscriptionTier): boolean {
  const quota = SUBSCRIPTION_QUOTAS[tier];
  return quota === null || activeListingCount < quota;
}

export type SubscriptionUpgradeEligibility =
  | { ok: true }
  | { ok: false; error: "not_an_upgrade" | "order_pending" };

export function checkSubscriptionUpgradeEligible({
  currentTier,
  targetTier,
  hasPendingOrder,
}: {
  currentTier: ProSubscriptionTier;
  targetTier: ProSubscriptionTier;
  hasPendingOrder: boolean;
}): SubscriptionUpgradeEligibility {
  if (hasPendingOrder) {
    return { ok: false, error: "order_pending" };
  }
  if (tierRank(targetTier) <= tierRank(currentTier)) {
    return { ok: false, error: "not_an_upgrade" };
  }
  return { ok: true };
}

// Un abonnement payant expiré (fin d'un cycle de 30 jours sans renouvellement)
// retombe silencieusement sur STARTER — jamais suspendu ou bloqué du jour au
// lendemain : les annonces existantes restent en l'état, seule la publication
// de NOUVELLES annonces au-delà du quota Starter redevient impossible.
export function effectiveTier(tier: ProSubscriptionTier, expiresAt: Date | null, now: Date): ProSubscriptionTier {
  if (tier === "STARTER") return "STARTER";
  if (expiresAt && expiresAt < now) return "STARTER";
  return tier;
}

// Lots 81-82 — "outils avancés" (docs/ARCHITECTURE.md §4-B : "Pro : Stock
// important + outils avancés (renouvellement auto, export)") : les deux
// outils cités partagent exactement la même porte, une seule fonction pour
// ne jamais laisser diverger deux vérifications de palier censées être
// identiques. Premium hérite de l'avantage de Pro (palier strictement
// supérieur), jamais Starter/Business qui ne sont jamais mentionnés avec ces
// outils dans le cahier des charges.
const ADVANCED_TOOLS_TIERS: ReadonlySet<ProSubscriptionTier> = new Set(["PRO", "PREMIUM"]);

export function hasAdvancedProTools(tier: ProSubscriptionTier): boolean {
  return ADVANCED_TOOLS_TIERS.has(tier);
}

export type SubscriptionStatus = {
  tier: ProSubscriptionTier; // effectif, après expiration éventuelle
  quota: number | null;
  activeListingCount: number;
};

// Une absence de ligne ProSubscription (compte pro jamais passé par
// l'upgrade) équivaut à STARTER — créée paresseusement seulement au moment
// d'un upgrade réel, jamais à l'inscription (même principe que
// PaymentSettings, une ligne "vide" n'apporte rien tant que rien n'a changé).
export async function getSubscriptionStatus(professionalAccountUserId: string): Promise<SubscriptionStatus | null> {
  const account = await prisma.professionalAccount.findUnique({
    where: { userId: professionalAccountUserId },
    include: { subscription: true },
  });
  if (!account) return null;

  const now = new Date();
  const tier = effectiveTier(account.subscription?.tier ?? "STARTER", account.subscription?.expiresAt ?? null, now);
  const activeListingCount = await prisma.listing.count({
    where: { sellerId: professionalAccountUserId, status: { in: QUOTA_COUNTED_STATUSES } },
  });

  return { tier, quota: SUBSCRIPTION_QUOTAS[tier], activeListingCount };
}
