import { describe, expect, it } from "vitest";
import { isLaunchNoticeActive } from "@/lib/launch-notice";

describe("isLaunchNoticeActive", () => {
  it("est actif avant la fin des 3 mois", () => {
    expect(isLaunchNoticeActive(new Date("2026-11-01T00:00:00Z"))).toBe(true);
  });

  it("n'est plus actif après la fin des 3 mois", () => {
    expect(isLaunchNoticeActive(new Date("2027-02-01T00:00:00Z"))).toBe(false);
  });
});
