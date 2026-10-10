import { describe, expect, it } from "vitest";
import { generateAnonymizedEmail } from "@/lib/account-deletion";

describe("generateAnonymizedEmail", () => {
  it("derives a deterministic, never-reusable email from the user id", () => {
    expect(generateAnonymizedEmail("cmt123abc")).toBe("deleted-cmt123abc@deleted.souqautos.com");
  });

  it("produces a different email for a different user id", () => {
    expect(generateAnonymizedEmail("user-a")).not.toBe(generateAnonymizedEmail("user-b"));
  });

  it("never contains the original user id ambiguously (always prefixed/suffixed identically)", () => {
    const email = generateAnonymizedEmail("xyz");
    expect(email.startsWith("deleted-")).toBe(true);
    expect(email.endsWith("@deleted.souqautos.com")).toBe(true);
  });
});
