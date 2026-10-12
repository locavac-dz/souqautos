import { beforeEach, describe, expect, it, vi } from "vitest";

const listingFindMany = vi.fn();
const listingUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: {
      findMany: (...a: unknown[]) => listingFindMany(...a),
      update: (...a: unknown[]) => listingUpdate(...a),
    },
  },
}));

const getFraudSignalsForListings = vi.fn();
vi.mock("@/lib/fraud-signals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/fraud-signals")>();
  return {
    ...actual,
    getFraudSignalsForListings: (...a: unknown[]) => getFraudSignalsForListings(...a),
  };
});

import {
  sweepListingRemoderation,
  activeSignalKeys,
  RECHECK_INTERVAL_DAYS,
  BATCH_SIZE,
} from "@/lib/listing-remoderation-sweep";
import { computeFraudScore, type FraudSignals } from "@/lib/fraud-signals";

const NOW = new Date("2026-10-12T03:00:00Z");

const NO_SIGNALS: FraudSignals = {
  duplicatePhoto: false,
  duplicateContent: false,
  duplicateVin: false,
  lowPrice: false,
  vehicleInconsistency: false,
  sellerRejectionHistory: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  listingUpdate.mockResolvedValue({});
});

describe("activeSignalKeys", () => {
  it("returns empty array when no signals active", () => {
    expect(activeSignalKeys(NO_SIGNALS)).toEqual([]);
  });

  it("returns active signal keys in weight order", () => {
    const signals = { ...NO_SIGNALS, duplicatePhoto: true, lowPrice: true };
    expect(activeSignalKeys(signals)).toEqual(["duplicatePhoto", "lowPrice"]);
  });
});

describe("constants", () => {
  it("re-checks every 7 days", () => {
    expect(RECHECK_INTERVAL_DAYS).toBe(7);
  });

  it("processes at most 200 listings per sweep", () => {
    expect(BATCH_SIZE).toBe(200);
  });
});

describe("sweepListingRemoderation", () => {
  it("returns zero when no stale listings exist", async () => {
    listingFindMany.mockResolvedValue([]);
    const result = await sweepListingRemoderation(NOW);
    expect(result).toEqual({ checked: 0, flagged: [] });
    expect(getFraudSignalsForListings).not.toHaveBeenCalled();
  });

  it("re-computes fraud score and updates fraudCheckedAt", async () => {
    const listing = {
      id: "l1",
      sellerId: "s1",
      title: "Clio 4",
      price: 2_500_000,
      brandId: 1,
      modelId: 1,
      year: 2018,
      mileage: 60_000,
      wilayaId: 16,
      condition: "OCCASION",
      contentHash: "abc",
      vin: null,
      fraudScore: 0,
      photos: [{ sha256: "hash1" }],
    };
    listingFindMany.mockResolvedValue([listing]);
    getFraudSignalsForListings.mockResolvedValue(new Map([["l1", NO_SIGNALS]]));

    const result = await sweepListingRemoderation(NOW);

    expect(result.checked).toBe(1);
    expect(result.flagged).toEqual([]);
    expect(listingUpdate).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { fraudScore: 0, fraudCheckedAt: NOW },
    });
  });

  it("flags a listing whose score increased from 0", async () => {
    const listing = {
      id: "l2",
      sellerId: "s2",
      title: "Golf 7 suspecte",
      price: 100_000,
      brandId: 2,
      modelId: 2,
      year: 2020,
      mileage: 10_000,
      wilayaId: 31,
      condition: "OCCASION",
      contentHash: "def",
      vin: "VIN123",
      fraudScore: 0,
      photos: [{ sha256: "hash2" }],
    };
    const newSignals: FraudSignals = {
      ...NO_SIGNALS,
      duplicatePhoto: true,
      duplicateVin: true,
    };
    listingFindMany.mockResolvedValue([listing]);
    getFraudSignalsForListings.mockResolvedValue(new Map([["l2", newSignals]]));

    const result = await sweepListingRemoderation(NOW);

    expect(result.checked).toBe(1);
    expect(result.flagged).toHaveLength(1);
    expect(result.flagged[0]).toEqual({
      id: "l2",
      title: "Golf 7 suspecte",
      oldScore: 0,
      newScore: computeFraudScore(newSignals),
      signals: ["duplicatePhoto", "duplicateVin"],
    });
  });

  it("does not flag when score stays the same", async () => {
    const listing = {
      id: "l3",
      sellerId: "s3",
      title: "208 stable",
      price: 1_800_000,
      brandId: 3,
      modelId: 3,
      year: 2016,
      mileage: 90_000,
      wilayaId: 9,
      condition: "OCCASION",
      contentHash: "ghi",
      vin: null,
      fraudScore: 20,
      photos: [],
    };
    const sameSignals: FraudSignals = { ...NO_SIGNALS, lowPrice: true };
    listingFindMany.mockResolvedValue([listing]);
    getFraudSignalsForListings.mockResolvedValue(new Map([["l3", sameSignals]]));

    const result = await sweepListingRemoderation(NOW);

    expect(result.flagged).toEqual([]);
    expect(listingUpdate).toHaveBeenCalledWith({
      where: { id: "l3" },
      data: { fraudScore: 20, fraudCheckedAt: NOW },
    });
  });

  it("does not flag when score decreased", async () => {
    const listing = {
      id: "l4",
      sellerId: "s4",
      title: "Sandero propre",
      price: 2_000_000,
      brandId: 4,
      modelId: 4,
      year: 2019,
      mileage: 50_000,
      wilayaId: 25,
      condition: "OCCASION",
      contentHash: "jkl",
      vin: null,
      fraudScore: 40,
      photos: [{ sha256: "hash4" }],
    };
    listingFindMany.mockResolvedValue([listing]);
    getFraudSignalsForListings.mockResolvedValue(new Map([["l4", NO_SIGNALS]]));

    const result = await sweepListingRemoderation(NOW);

    expect(result.flagged).toEqual([]);
    expect(listingUpdate).toHaveBeenCalledWith({
      where: { id: "l4" },
      data: { fraudScore: 0, fraudCheckedAt: NOW },
    });
  });

  it("handles multiple listings, only flags those with increased score", async () => {
    const clean = {
      id: "clean",
      sellerId: "s1",
      title: "Clean",
      price: 2_000_000,
      brandId: 1,
      modelId: 1,
      year: 2018,
      mileage: 60_000,
      wilayaId: 16,
      condition: "OCCASION",
      contentHash: "aaa",
      vin: null,
      fraudScore: 0,
      photos: [],
    };
    const dirty = {
      id: "dirty",
      sellerId: "s2",
      title: "Dirty",
      price: 100_000,
      brandId: 2,
      modelId: 2,
      year: 2020,
      mileage: null,
      wilayaId: 31,
      condition: "OCCASION",
      contentHash: "bbb",
      vin: null,
      fraudScore: 0,
      photos: [{ sha256: "dup" }],
    };
    listingFindMany.mockResolvedValue([clean, dirty]);
    getFraudSignalsForListings.mockResolvedValue(
      new Map([
        ["clean", NO_SIGNALS],
        ["dirty", { ...NO_SIGNALS, duplicateContent: true }],
      ]),
    );

    const result = await sweepListingRemoderation(NOW);

    expect(result.checked).toBe(2);
    expect(result.flagged).toHaveLength(1);
    expect(result.flagged[0].id).toBe("dirty");
  });

  it("still updates fraudCheckedAt when signals map has no entry for a listing", async () => {
    const listing = {
      id: "orphan",
      sellerId: "s5",
      title: "Orphan",
      price: 1_000_000,
      brandId: null,
      modelId: null,
      year: 2015,
      mileage: 200_000,
      wilayaId: 42,
      condition: "OCCASION",
      contentHash: "xyz",
      vin: null,
      fraudScore: 0,
      photos: [],
    };
    listingFindMany.mockResolvedValue([listing]);
    getFraudSignalsForListings.mockResolvedValue(new Map());

    const result = await sweepListingRemoderation(NOW);

    expect(result.checked).toBe(1);
    expect(result.flagged).toEqual([]);
    expect(listingUpdate).toHaveBeenCalledWith({
      where: { id: "orphan" },
      data: { fraudCheckedAt: NOW },
    });
  });
});
