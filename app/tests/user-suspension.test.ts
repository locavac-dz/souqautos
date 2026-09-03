import { describe, expect, it } from "vitest";
import { checkCanSuspendUser } from "@/lib/user-suspension";

describe("checkCanSuspendUser", () => {
  it("allows suspending a real, non-staff target", () => {
    expect(checkCanSuspendUser({ isSelf: false, targetIsStaff: false })).toEqual({ ok: true });
  });

  it("blocks suspending yourself", () => {
    expect(checkCanSuspendUser({ isSelf: true, targetIsStaff: false })).toEqual({
      ok: false,
      error: "cannot_suspend_self",
    });
  });

  it("blocks suspending a staff member", () => {
    expect(checkCanSuspendUser({ isSelf: false, targetIsStaff: true })).toEqual({
      ok: false,
      error: "cannot_suspend_staff",
    });
  });

  it("prioritizes the self-check over the staff check", () => {
    expect(checkCanSuspendUser({ isSelf: true, targetIsStaff: true })).toEqual({
      ok: false,
      error: "cannot_suspend_self",
    });
  });
});
