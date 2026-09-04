import { describe, expect, it } from "vitest";
import { checkDraftPayload, MAX_DRAFT_BYTES } from "@/lib/wizard-draft";

describe("checkDraftPayload", () => {
  it("accepts a plain object", () => {
    expect(checkDraftPayload({ title: "Renault Clio", price: 1200000 })).toEqual({ ok: true });
  });

  it("accepts an empty object", () => {
    expect(checkDraftPayload({})).toEqual({ ok: true });
  });

  it("rejects null", () => {
    expect(checkDraftPayload(null)).toEqual({ ok: false, error: "invalid_payload" });
  });

  it("rejects undefined", () => {
    expect(checkDraftPayload(undefined)).toEqual({ ok: false, error: "invalid_payload" });
  });

  it("rejects an array", () => {
    expect(checkDraftPayload([1, 2, 3])).toEqual({ ok: false, error: "invalid_payload" });
  });

  it("rejects a primitive", () => {
    expect(checkDraftPayload("not an object")).toEqual({ ok: false, error: "invalid_payload" });
    expect(checkDraftPayload(42)).toEqual({ ok: false, error: "invalid_payload" });
  });

  it("rejects a payload larger than the size limit", () => {
    const big = { description: "x".repeat(MAX_DRAFT_BYTES + 1) };
    expect(checkDraftPayload(big)).toEqual({ ok: false, error: "too_large" });
  });

  it("accepts a payload right at the size limit boundary", () => {
    // Compte le JSON complet (accolades, guillemets, clé) sous la limite.
    const overhead = JSON.stringify({ description: "" }).length;
    const filler = "x".repeat(MAX_DRAFT_BYTES - overhead);
    expect(checkDraftPayload({ description: filler })).toEqual({ ok: true });
  });
});
