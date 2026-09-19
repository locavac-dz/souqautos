import type { ListingStatus, ProSubscriptionTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getProSubscriptionSettings, type ProSubscriptionSettingsValues } from "@/lib/pro-subscription-settings";

// Lot 79 — abonnements professionnels (§4-B/§11 du cahier d'architecture).
// Lot 83 — quotas/prix rendus configurables (src/lib/pro-subscription-settings.ts) :
// chaque fonction ci-dessous prend désormais les paramètres réels en entrée,
// jamais une constante interne — même patron que priceForFormula (Lot 66,
// src/lib/payment-orders.ts), pour ne jamais lire une valeur figée à côté de
// la vraie source de configuration.
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

export function priceForTier(
  tier: "BUSINESS" | "PRO" | "PREMIUM",
  settings: ProSubscriptionSettingsValues
): number {
  switch (tier) {
    case "BUSINESS":
      return settings.businessPriceDzd;
    case "PRO":
      return settings.proPriceDzd;
    case "PREMIUM":
      return settings.premiumPriceDzd;
  }
}

// Variante utilisée par la page publique /professionnels (Lot 80), qui doit
// afficher les 4 paliers y compris STARTER (gratuit, donc `null`).
export function priceForAnyTier(tier: ProSubscriptionTier, settings: ProSubscriptionSettingsValues): number | null {
  return tier === "STARTER" ? null : priceForTier(tier, settings);
}

export function quotaForTier(tier: ProSubscriptionTier, settings: ProSubscriptionSettingsValues): number | null {
  switch (tier) {
    case "STARTER":
      return settings.starterQuota;
    case "BUSINESS":
      return settings.businessQuota;
    case "PRO":
      return settings.proQuota;
    case "PREMIUM":
      return null; // illimité — jamais un nombre, aussi grand soit-il, pour "illimité"
  }
}

// Statuts qui "occupent" une place dans le quota — jamais REFUSEE (jamais
// entrée dans le stock actif), VENDUE ou EXPIREE (annonces closes, ne
// bloquent pas de nouvelles publications). BROUILLON compte : un brouillon
// deviendra une vraie annonce dès qu'il sera complété, il occupe déjà
// nominalement une place dans le stock du compte pro.
export const QUOTA_COUNTED_STATUSES: ListingStatus[] = ["BROUILLON", "EN_ATTENTE", "PUBLIEE", "SUSPENDUE"];

// Prend directement le quota déjà résolu (cf. SubscriptionStatus.quota) —
// jamais besoin de re-fournir le palier/les settings à cet appel, qui n'a
// plus qu'une comparaison à faire.
export function isWithinQuota(activeListingCount: number, quota: number | null): boolean {
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
// outils dans le cahier des charges. Jamais dépendante des settings
// configurables (Lot 83) — quels que soient les quotas/prix choisis par
// l'admin, seuls Pro/Premium ont accès à ces outils, ce n'est pas un
// paramètre éditable.
const ADVANCED_TOOLS_TIERS: ReadonlySet<ProSubscriptionTier> = new Set(["PRO", "PREMIUM"]);

export function hasAdvancedProTools(tier: ProSubscriptionTier): boolean {
  return ADVANCED_TOOLS_TIERS.has(tier);
}

// Lot 122 — statistiques DÉTAILLÉES par annonce (vues, favoris, appels, WhatsApp, conversations,
// taux de contact). Les totaux et courbes de la période restent visibles à tous les comptes pro : le
// détail par annonce est ce qui justifie un abonnement. Fonction distincte de hasAdvancedProTools pour
// pouvoir changer ce palier sans toucher au renouvellement automatique ni à l'export ; elle en reprend
// aujourd'hui la règle (Pro et Premium).
export function hasDetailedStatistics(tier: ProSubscriptionTier): boolean {
  return hasAdvancedProTools(tier);
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
  const [account, settings] = await Promise.all([
    prisma.professionalAccount.findUnique({
      where: { userId: professionalAccountUserId },
      include: { subscription: true },
    }),
    getProSubscriptionSettings(),
  ]);
  if (!account) return null;

  const now = new Date();
  const tier = effectiveTier(account.subscription?.tier ?? "STARTER", account.subscription?.expiresAt ?? null, now);
  const activeListingCount = await prisma.listing.count({
    where: { sellerId: professionalAccountUserId, status: { in: QUOTA_COUNTED_STATUSES } },
  });

  return { tier, quota: quotaForTier(tier, settings), activeListingCount };
}
