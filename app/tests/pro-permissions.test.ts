import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRO_PERMISSIONS,
  parseProPermissions,
  serializeProPermissions,
} from "@/lib/pro-permissions";

describe("serializeProPermissions / parseProPermissions", () => {
  it("round-trips a permissions object", () => {
    const permissions = { gererAnnonces: true, repondreAvis: false };
    expect(parseProPermissions(serializeProPermissions(permissions))).toEqual(permissions);
  });

  it("defaults every field to false when the stored JSON is invalid", () => {
    expect(parseProPermissions("not json at all")).toEqual(DEFAULT_PRO_PERMISSIONS);
  });

  it("coerces a missing field to false rather than throwing", () => {
    expect(parseProPermissions('{"gererAnnonces":true}')).toEqual({
      gererAnnonces: true,
      repondreAvis: false,
    });
  });

  it("coerces a non-boolean value to a boolean", () => {
    expect(parseProPermissions('{"gererAnnonces":"oui","repondreAvis":0}')).toEqual({
      gererAnnonces: true,
      repondreAvis: false,
    });
  });

  it("defaults to false for an empty JSON object", () => {
    expect(parseProPermissions("{}")).toEqual(DEFAULT_PRO_PERMISSIONS);
  });
});
