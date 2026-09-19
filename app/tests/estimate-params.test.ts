import { describe, expect, it } from "vitest";
import { estimateParamsSchema } from "@/lib/validation/estimate";

describe("estimateParamsSchema", () => {
  it("coerces numeric fields from strings", () => {
    expect(estimateParamsSchema.parse({ brandId: "3", year: "2019" })).toMatchObject({ brandId: 3, year: 2019 });
  });

  it("drops a value beyond the 32-bit range instead of passing it to the database", () => {
    const result = estimateParamsSchema.parse({ brandId: "99999999999", mileage: "2147483648" });
    expect(result.brandId).toBeUndefined();
    expect(result.mileage).toBeUndefined();
  });
});
