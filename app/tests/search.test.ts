import { describe, expect, it } from "vitest";
import { searchParamsSchema } from "@/lib/validation/search";
import {
  buildListingWhere,
  buildListingOrderBy,
  currentPage,
  paginationOffset,
  totalPages,
} from "@/lib/search";

describe("searchParamsSchema", () => {
  it("parses an empty query string into an empty object", () => {
    const result = searchParamsSchema.parse({});
    expect(result).toEqual({});
  });

  it("coerces numeric fields from strings", () => {
    const result = searchParamsSchema.parse({ brandId: "3", priceMin: "1000000", page: "2" });
    expect(result.brandId).toBe(3);
    expect(result.priceMin).toBe(1_000_000);
    expect(result.page).toBe(2);
  });

  it("silently drops an invalid numeric value instead of throwing", () => {
    const result = searchParamsSchema.parse({ brandId: "not-a-number" });
    expect(result.brandId).toBeUndefined();
  });

  it("silently drops an invalid enum value instead of throwing", () => {
    const result = searchParamsSchema.parse({ fuelType: "KEROSENE" });
    expect(result.fuelType).toBeUndefined();
  });

  it("accepts a known sort option", () => {
    const result = searchParamsSchema.parse({ sort: "price_asc" });
    expect(result.sort).toBe("price_asc");
  });

  it("parses a comma-separated equipmentIds list into a deduplicated number array", () => {
    const result = searchParamsSchema.parse({ equipmentIds: "3,1,3,2" });
    expect(result.equipmentIds).toEqual([3, 1, 2]);
  });

  it("drops non-positive or non-integer equipment ids instead of throwing", () => {
    const result = searchParamsSchema.parse({ equipmentIds: "1,0,-2,abc,4" });
    expect(result.equipmentIds).toEqual([1, 4]);
  });

  it("omits equipmentIds entirely when the list ends up empty", () => {
    const result = searchParamsSchema.parse({ equipmentIds: "0,abc" });
    expect(result.equipmentIds).toBeUndefined();
  });
});

describe("buildListingWhere", () => {
  it("always scopes to published listings", () => {
    const where = buildListingWhere({});
    expect(where.status).toBe("PUBLIEE");
  });

  it("adds an OR clause across title/brand/model/wilaya for free text", () => {
    const where = buildListingWhere({ q: "clio" });
    expect(Array.isArray(where.OR)).toBe(true);
    expect(where.OR).toHaveLength(7);
  });

  it("omits the OR clause when no query text is given", () => {
    const where = buildListingWhere({});
    expect(where.OR).toBeUndefined();
  });

  it("combines price min and max into a single range filter", () => {
    const where = buildListingWhere({ priceMin: 1_000_000, priceMax: 3_000_000 });
    expect(where.price).toEqual({ gte: 1_000_000, lte: 3_000_000 });
  });

  it("applies only the provided bound when the other is absent", () => {
    const where = buildListingWhere({ yearMin: 2015 });
    expect(where.year).toEqual({ gte: 2015 });
  });

  it("passes through simple equality filters", () => {
    const where = buildListingWhere({
      category: "VOITURE",
      brandId: 1,
      wilayaId: 16,
      fuelType: "DIESEL",
      gearbox: "MANUELLE",
      condition: "OCCASION",
    });
    expect(where).toMatchObject({
      status: "PUBLIEE",
      category: "VOITURE",
      brandId: 1,
      wilayaId: 16,
      fuelType: "DIESEL",
      gearbox: "MANUELLE",
      condition: "OCCASION",
    });
  });

  it("omits the equipment filter when no equipment is requested", () => {
    const where = buildListingWhere({});
    expect(where.AND).toBeUndefined();
  });

  it("requires every selected equipment via an independent `some` clause (AND, never OR)", () => {
    const where = buildListingWhere({ equipmentIds: [1, 2] });
    expect(where.AND).toEqual([
      { equipments: { some: { equipmentId: 1 } } },
      { equipments: { some: { equipmentId: 2 } } },
    ]);
  });
});

describe("buildListingOrderBy", () => {
  it("defaults to most recent first", () => {
    expect(buildListingOrderBy(undefined)).toEqual({ createdAt: "desc" });
    expect(buildListingOrderBy("recent")).toEqual({ createdAt: "desc" });
  });

  it("orders by price ascending or descending", () => {
    expect(buildListingOrderBy("price_asc")).toEqual({ price: "asc" });
    expect(buildListingOrderBy("price_desc")).toEqual({ price: "desc" });
  });
});

describe("pagination helpers", () => {
  it("defaults to page 1 and offset 0", () => {
    expect(currentPage({})).toBe(1);
    expect(paginationOffset({})).toBe(0);
  });

  it("computes the correct offset for a later page", () => {
    expect(currentPage({ page: 3 })).toBe(3);
    expect(paginationOffset({ page: 3 })).toBe(40); // (3-1) * 20
  });

  it("clamps a non-positive page number to 1", () => {
    expect(currentPage({ page: 0 })).toBe(1);
  });

  it("computes total pages from a result count, minimum 1", () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(20)).toBe(1);
    expect(totalPages(21)).toBe(2);
    expect(totalPages(41)).toBe(3);
  });
});
