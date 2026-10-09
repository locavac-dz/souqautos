import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

// --- mocks ------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    searchAlert: { findMany: vi.fn() },
    listing: { findFirst: vi.fn() },
    searchAlertNotification: { create: vi.fn() },
  },
}));

// Lot 271 — notifyUser passe par sendEmailBestEffort : il délègue au même espion que sendEmail.
const { sendEmailSpy } = vi.hoisted(() => ({ sendEmailSpy: vi.fn() }));
vi.mock("@/lib/mailer", () => ({
  sendEmail: sendEmailSpy,
  sendEmailBestEffort: (_tag: string, args: unknown) => Promise.resolve(sendEmailSpy(args)).catch(() => null),
  escapeHtml: (s: string) => s,
}));

vi.mock("@/lib/push-send", () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

vi.mock("@/lib/site", () => ({ SITE_URL: "https://souq-auto.dz" }));

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";
import { sendPushToUser } from "@/lib/push-send";
import { notifyMatchingSearchAlerts } from "@/lib/search-alerts";

// ---------------------------------------------------------------------------

const makeListing = (overrides?: Partial<{ id: string; sellerId: string }>) => ({
  id: "listing-1",
  sellerId: "seller-1",
  title: "Renault Clio",
  price: 750000,
  status: "PUBLIEE",
  brandId: "brand-1",
  modelId: "model-1",
  wilayaId: "wilaya-16",
  year: 2020,
  mileage: 40000,
  fuelType: "ESSENCE",
  gearbox: "MANUELLE",
  condition: "OCCASION",
  ...overrides,
});

const makeAlert = (overrides?: Record<string, unknown>) => ({
  id: "alert-1",
  userId: "user-2",
  label: "Mon alerte",
  filters: JSON.stringify({ brandId: "brand-1" }),
  user: { id: "user-2", email: "user@test.com", locale: "fr" },
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  // resetAllMocks efface les implémentations — on les réinstalle explicitement.
  vi.mocked(getTranslations).mockResolvedValue(((key: string) => key) as never);
  vi.mocked(sendEmail).mockResolvedValue(null as never);
  vi.mocked(sendPushToUser).mockResolvedValue({ sent: 0, removed: 0, failed: 0 });
  vi.mocked(prisma.searchAlertNotification.create).mockResolvedValue({} as never);
});

// ---------------------------------------------------------------------------

describe("notifyMatchingSearchAlerts", () => {
  it("ne notifie aucune alerte si le seul détenteur est le vendeur", async () => {
    vi.mocked(prisma.searchAlert.findMany).mockResolvedValue([]);
    await notifyMatchingSearchAlerts(makeListing() as never);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("passe userId: { not: sellerId } à searchAlert.findMany", async () => {
    vi.mocked(prisma.searchAlert.findMany).mockResolvedValue([]);
    await notifyMatchingSearchAlerts(makeListing({ sellerId: "s-42" }) as never);
    expect(prisma.searchAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: { not: "s-42" } } })
    );
  });

  it("n'envoie rien si l'annonce ne correspond pas aux filtres de l'alerte", async () => {
    vi.mocked(prisma.searchAlert.findMany).mockResolvedValue([makeAlert()] as never);
    vi.mocked(prisma.listing.findFirst).mockResolvedValue(null);
    await notifyMatchingSearchAlerts(makeListing() as never);
    expect(prisma.searchAlertNotification.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("envoie email + push si l'annonce correspond à une alerte", async () => {
    vi.mocked(prisma.searchAlert.findMany).mockResolvedValue([makeAlert()] as never);
    vi.mocked(prisma.listing.findFirst).mockResolvedValue({ id: "listing-1" } as never);
    await notifyMatchingSearchAlerts(makeListing() as never);
    expect(prisma.searchAlertNotification.create).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendPushToUser).toHaveBeenCalledOnce();
  });

  it("ne double-notifie pas (P2002 → aucun email ni push)", async () => {
    vi.mocked(prisma.searchAlert.findMany).mockResolvedValue([makeAlert()] as never);
    vi.mocked(prisma.listing.findFirst).mockResolvedValue({ id: "listing-1" } as never);
    vi.mocked(prisma.searchAlertNotification.create).mockRejectedValue(
      Object.assign(new Prisma.PrismaClientKnownRequestError("Unique", { code: "P2002", clientVersion: "5" }))
    );
    await notifyMatchingSearchAlerts(makeListing() as never);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("ignore en silence une alerte aux filtres corrompus", async () => {
    const corrupted = makeAlert({ filters: "NOT_JSON" });
    vi.mocked(prisma.searchAlert.findMany).mockResolvedValue([corrupted] as never);
    await notifyMatchingSearchAlerts(makeListing() as never);
    expect(prisma.listing.findFirst).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("traite plusieurs alertes en parallèle — chaque correspondante reçoit email + push", async () => {
    const alert2 = makeAlert({ id: "alert-2", userId: "user-3", user: { id: "user-3", email: "u3@test.com", locale: "ar" } });
    vi.mocked(prisma.searchAlert.findMany).mockResolvedValue([makeAlert(), alert2] as never);
    vi.mocked(prisma.listing.findFirst).mockResolvedValue({ id: "listing-1" } as never);
    await notifyMatchingSearchAlerts(makeListing() as never);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendPushToUser).toHaveBeenCalledTimes(2);
  });
});
