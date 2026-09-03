import { describe, expect, it } from "vitest";
import { shouldResetPhoneVerification } from "@/lib/profile";

describe("shouldResetPhoneVerification", () => {
  it("does not reset when the phone number is unchanged", () => {
    expect(shouldResetPhoneVerification({ oldPhone: "0555123456", newPhone: "0555123456" })).toBe(false);
  });

  it("resets when the phone number changes to a different one", () => {
    expect(shouldResetPhoneVerification({ oldPhone: "0555123456", newPhone: "0666123456" })).toBe(true);
  });

  it("resets when a phone number is added where there was none", () => {
    expect(shouldResetPhoneVerification({ oldPhone: null, newPhone: "0555123456" })).toBe(true);
  });

  it("resets when the phone number is removed", () => {
    expect(shouldResetPhoneVerification({ oldPhone: "0555123456", newPhone: null })).toBe(true);
  });

  it("does not reset when there was and still is no phone number", () => {
    expect(shouldResetPhoneVerification({ oldPhone: null, newPhone: null })).toBe(false);
  });
});
