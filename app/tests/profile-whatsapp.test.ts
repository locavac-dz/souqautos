import { describe, expect, it } from "vitest";
import { profileUpdateSchema } from "@/lib/validation/profile";

// Lot 119 — préférence WhatsApp du vendeur.
describe("profileUpdateSchema — whatsappEnabled", () => {
  const base = { displayName: "Amine", phone: "0555123456" };

  it("accepts a boolean choice, or none", () => {
    expect(profileUpdateSchema.safeParse({ ...base, whatsappEnabled: true }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ ...base, whatsappEnabled: false }).success).toBe(true);
    expect(profileUpdateSchema.safeParse(base).success).toBe(true);
  });

  it("refuses anything that is not a boolean", () => {
    for (const whatsappEnabled of ["true", 1, null, "oui"]) {
      expect(profileUpdateSchema.safeParse({ ...base, whatsappEnabled }).success).toBe(false);
    }
  });
});
