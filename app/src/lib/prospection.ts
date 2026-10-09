// Lot 274 — liste de prospection générée depuis la base, pour le commercial (au lancement : le PDG).
//
// Trois cibles, dans l'ordre où elles rapportent : les particuliers qui publient comme des professionnels
// (concessionnaires qui s'ignorent), les comptes pro sans abonnement payant, et les abonnements qui expirent
// sous quinze jours. Aucune donnée inventée : des comptes réels, leurs annonces réelles.
import type { ProSubscriptionTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { effectiveTier } from "@/lib/pro-subscription";

export const PROSPECT_MIN_LISTINGS = 5;
export const PROSPECT_EXPIRY_WINDOW_DAYS = 15;
const MAX_ROWS = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ProspectKind = "no_subscription" | "expiring" | "active";

// Pur : où en est un compte pro vis-à-vis de l'abonnement payant ?
export function classifyProAccount(input: { tier: ProSubscriptionTier | null; expiresAt: Date | null; now: Date }): ProspectKind {
  const tier = effectiveTier(input.tier ?? "STARTER", input.expiresAt, input.now);
  if (tier === "STARTER") return "no_subscription";
  if (input.expiresAt && input.expiresAt.getTime() - input.now.getTime() <= PROSPECT_EXPIRY_WINDOW_DAYS * DAY_MS) return "expiring";
  return "active";
}

export type ParticulierProspect = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  wilaya: string | null;
  listingCount: number;
  lastListingAt: Date | null;
};

export type ProProspect = {
  accountId: string;
  name: string;
  email: string;
  phone: string | null;
  wilaya: string | null;
  listingCount: number;
  tier: ProSubscriptionTier;
  expiresAt: Date | null;
  badgeVerifie: boolean;
};

export type ProspectionLists = {
  particuliers: ParticulierProspect[];
  prosWithoutSubscription: ProProspect[];
  prosExpiring: ProProspect[];
};

function wilayaName(w: { nomFr: string; nomAr: string } | null | undefined, locale: string): string | null {
  if (!w) return null;
  return locale === "ar" ? w.nomAr : w.nomFr;
}

export async function buildProspectionLists(locale: string, now: Date = new Date()): Promise<ProspectionLists> {
  // 1. Particuliers à PROSPECT_MIN_LISTINGS annonces et plus (brouillons exclus), hors comptes suspendus/supprimés.
  const groups = await prisma.listing.groupBy({
    by: ["sellerId"],
    where: {
      status: { not: "BROUILLON" },
      seller: { role: "PARTICULIER", professionalAccount: null, suspendedAt: null, deletedAt: null },
    },
    _count: { _all: true },
    _max: { createdAt: true },
    having: { sellerId: { _count: { gte: PROSPECT_MIN_LISTINGS } } },
    orderBy: { _count: { sellerId: "desc" } },
    take: MAX_ROWS,
  });
  // Lecture DIRECTE des utilisateurs : le téléphone n'est déchiffré que sur le modèle User lui-même (cf. route contact).
  const users = groups.length
    ? await prisma.user.findMany({
        where: { id: { in: groups.map((g) => g.sellerId) } },
        select: { id: true, email: true, phone: true, profile: { select: { displayName: true, wilaya: { select: { nomFr: true, nomAr: true } } } } },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));
  const particuliers: ParticulierProspect[] = groups.flatMap((g) => {
    const u = userById.get(g.sellerId);
    if (!u) return [];
    return [{
      userId: u.id,
      name: u.profile?.displayName ?? u.email,
      email: u.email,
      phone: u.phone ?? null,
      wilaya: wilayaName(u.profile?.wilaya, locale),
      listingCount: g._count._all,
      lastListingAt: g._max.createdAt,
    }];
  });

  // 2 & 3. Comptes pro : sans abonnement payant, ou abonnement qui expire sous quinze jours.
  const accounts = await prisma.professionalAccount.findMany({
    where: { user: { suspendedAt: null, deletedAt: null } },
    select: {
      id: true,
      nomCommercial: true,
      phone: true,
      badgeVerifie: true,
      userId: true,
      wilaya: { select: { nomFr: true, nomAr: true } },
      subscription: { select: { tier: true, expiresAt: true } },
    },
  });
  const proUserIds = accounts.map((a) => a.userId);
  const [proUsers, proCounts] = await Promise.all([
    proUserIds.length
      ? prisma.user.findMany({ where: { id: { in: proUserIds } }, select: { id: true, email: true, phone: true } })
      : Promise.resolve([]),
    proUserIds.length
      ? prisma.listing.groupBy({ by: ["sellerId"], where: { sellerId: { in: proUserIds }, status: { not: "BROUILLON" } }, _count: { _all: true } })
      : Promise.resolve([]),
  ]);
  const proUserById = new Map(proUsers.map((u) => [u.id, u]));
  const countBySeller = new Map(proCounts.map((c) => [c.sellerId, c._count._all]));

  const prosWithoutSubscription: ProProspect[] = [];
  const prosExpiring: ProProspect[] = [];
  for (const a of accounts) {
    const u = proUserById.get(a.userId);
    if (!u) continue;
    const kind = classifyProAccount({ tier: a.subscription?.tier ?? null, expiresAt: a.subscription?.expiresAt ?? null, now });
    if (kind === "active") continue;
    const row: ProProspect = {
      accountId: a.id,
      name: a.nomCommercial,
      email: u.email,
      phone: a.phone ?? u.phone ?? null,
      wilaya: wilayaName(a.wilaya, locale),
      listingCount: countBySeller.get(a.userId) ?? 0,
      tier: effectiveTier(a.subscription?.tier ?? "STARTER", a.subscription?.expiresAt ?? null, now),
      expiresAt: a.subscription?.expiresAt ?? null,
      badgeVerifie: a.badgeVerifie,
    };
    (kind === "expiring" ? prosExpiring : prosWithoutSubscription).push(row);
  }
  prosWithoutSubscription.sort((x, y) => y.listingCount - x.listingCount);
  prosExpiring.sort((x, y) => (x.expiresAt?.getTime() ?? 0) - (y.expiresAt?.getTime() ?? 0));

  return { particuliers, prosWithoutSubscription: prosWithoutSubscription.slice(0, MAX_ROWS), prosExpiring: prosExpiring.slice(0, MAX_ROWS) };
}
