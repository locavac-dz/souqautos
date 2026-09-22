import { describe, expect, it } from "vitest";
import {
  assembleDirectoryEntries,
  countByWilaya,
  directoryParamsSchema,
  filterByWilaya,
  paginate,
  sortDirectoryEntries,
  type DirectoryEntry,
} from "@/lib/professional-directory";

function entry(overrides: Partial<DirectoryEntry> & { id: string }): DirectoryEntry {
  return {
    nomCommercial: overrides.id,
    logoUrl: null,
    badgeVerifie: false,
    wilayaId: 16,
    categoryPro: null,
    listingCount: 1,
    ratingAverage: 0,
    ratingCount: 0,
    ...overrides,
  };
}

describe("assembleDirectoryEntries", () => {
  const account = (id: string, userId: string) => ({
    id,
    userId,
    nomCommercial: `Garage ${id}`,
    logoUrl: null,
    badgeVerifie: false,
    wilayaId: 16,
    categoryPro: null as null,
  });

  it("keeps only accounts with at least one published listing", () => {
    const entries = assembleDirectoryEntries({
      accounts: [account("a", "ua"), account("b", "ub"), account("c", "uc")],
      listingCounts: new Map([["ua", 3]]),
      ratings: new Map(),
    });
    expect(entries.map((e) => e.id)).toEqual(["a"]);
    expect(entries[0].listingCount).toBe(3);
  });

  it("computes the average rating and review count of each account", () => {
    const [result] = assembleDirectoryEntries({
      accounts: [account("a", "ua")],
      listingCounts: new Map([["ua", 1]]),
      ratings: new Map([["a", [5, 4]]]),
    });
    expect(result.ratingAverage).toBe(4.5);
    expect(result.ratingCount).toBe(2);
  });

  it("reports no rating for an account without reviews", () => {
    const [result] = assembleDirectoryEntries({
      accounts: [account("a", "ua")],
      listingCounts: new Map([["ua", 1]]),
      ratings: new Map(),
    });
    expect(result.ratingCount).toBe(0);
  });
});

describe("sortDirectoryEntries", () => {
  it("puts verified accounts first even with a smaller stock", () => {
    const sorted = sortDirectoryEntries([
      entry({ id: "big", listingCount: 50 }),
      entry({ id: "verified", badgeVerifie: true, listingCount: 2 }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["verified", "big"]);
  });

  it("then sorts by number of listings, largest first", () => {
    const sorted = sortDirectoryEntries([
      entry({ id: "small", listingCount: 1 }),
      entry({ id: "large", listingCount: 9 }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["large", "small"]);
  });

  it("then alphabetically on ties", () => {
    const sorted = sortDirectoryEntries([entry({ id: "Zeta" }), entry({ id: "Alpha" })]);
    expect(sorted.map((e) => e.id)).toEqual(["Alpha", "Zeta"]);
  });

  it("does not mutate the input array", () => {
    const input = [entry({ id: "b" }), entry({ id: "a" })];
    sortDirectoryEntries(input);
    expect(input.map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("filterByWilaya", () => {
  const entries = [entry({ id: "a", wilayaId: 16 }), entry({ id: "b", wilayaId: 68 }), entry({ id: "c", wilayaId: null })];

  it("returns everything when no wilaya is selected", () => {
    expect(filterByWilaya(entries, undefined)).toHaveLength(3);
  });

  it("keeps only the accounts of the selected wilaya", () => {
    expect(filterByWilaya(entries, 68).map((e) => e.id)).toEqual(["b"]);
  });
});

describe("countByWilaya", () => {
  it("counts accounts per wilaya and ignores accounts without a wilaya", () => {
    const counts = countByWilaya([
      entry({ id: "a", wilayaId: 16 }),
      entry({ id: "b", wilayaId: 16 }),
      entry({ id: "c", wilayaId: 68 }),
      entry({ id: "d", wilayaId: null }),
    ]);
    expect(counts.get(16)).toBe(2);
    expect(counts.get(68)).toBe(1);
    expect(counts.size).toBe(2);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it("returns the first page by default", () => {
    const result = paginate(items, undefined, 12);
    expect(result.items).toHaveLength(12);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(3);
    expect(result.totalCount).toBe(25);
  });

  it("returns the remaining items on the last page", () => {
    expect(paginate(items, 3, 12).items).toEqual([25]);
  });

  it("clamps a page beyond the last one to the last page", () => {
    expect(paginate(items, 99, 12).page).toBe(3);
  });

  it("clamps a page below 1 to the first page", () => {
    expect(paginate(items, 0, 12).page).toBe(1);
  });

  it("still reports one page for an empty list", () => {
    const result = paginate([], undefined, 12);
    expect(result.totalPages).toBe(1);
    expect(result.items).toEqual([]);
  });
});

describe("directoryParamsSchema", () => {
  it("parses a wilaya slug and a page number", () => {
    expect(directoryParamsSchema.parse({ wilaya: "alger", page: "2" })).toEqual({ wilaya: "alger", page: 2 });
  });

  it("silently drops a non-numeric page", () => {
    expect(directoryParamsSchema.parse({ page: "abc" }).page).toBeUndefined();
  });

  it("accepts no parameters at all", () => {
    expect(directoryParamsSchema.parse({})).toEqual({});
  });
});
