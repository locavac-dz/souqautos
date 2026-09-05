import { describe, expect, it } from "vitest";
import { formatAuditLogDetails } from "@/lib/audit-log";

describe("formatAuditLogDetails", () => {
  it("renders a dash when there are no details", () => {
    expect(formatAuditLogDetails(null)).toBe("—");
  });

  it("renders key/value pairs joined by a middle dot", () => {
    expect(
      formatAuditLogDetails(JSON.stringify({ previousStatus: "EN_ATTENTE", newStatus: "PUBLIEE" }))
    ).toBe("previousStatus: EN_ATTENTE · newStatus: PUBLIEE");
  });

  it("skips null/undefined fields", () => {
    expect(formatAuditLogDetails(JSON.stringify({ reason: null, requesterId: "u1" }))).toBe(
      "requesterId: u1"
    );
  });

  it("falls back to the raw string if it isn't valid JSON", () => {
    expect(formatAuditLogDetails("not json")).toBe("not json");
  });
});
