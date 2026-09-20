import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const userFindUnique = vi.fn();

vi.mock("@/lib/auth-server/session", () => ({ getSessionFromCookies: () => getSession() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => userFindUnique(...a) } } }));

import { getCurrentUser } from "@/lib/auth-server/current-user";

const RESET = new Date("2026-09-20T10:00:00.500Z");
const session = (issuedAtMs: number) => ({ sub: "user-1", role: "PARTICULIER", issuedAtMs });
const user = (overrides: Record<string, unknown> = {}) => ({ id: "user-1", suspendedAt: null, deletedAt: null, sessionsValidAfter: null, ...overrides });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getCurrentUser — sessions revoked by a password reset (Lot 133)", () => {
  it("refuses a session opened before the reset, even by a single millisecond", async () => {
    userFindUnique.mockResolvedValue(user({ sessionsValidAfter: RESET }));
    getSession.mockResolvedValue(session(RESET.getTime() - 1));
    expect(await getCurrentUser()).toBeNull();
    getSession.mockResolvedValue(session(RESET.getTime() - 3_600_000));
    expect(await getCurrentUser()).toBeNull();
  });

  it("accepts a session opened at, or after, the reset — including within the same second", async () => {
    userFindUnique.mockResolvedValue(user({ sessionsValidAfter: RESET }));
    getSession.mockResolvedValue(session(RESET.getTime()));
    expect(await getCurrentUser()).toMatchObject({ id: "user-1" });
    getSession.mockResolvedValue(session(RESET.getTime() + 1));
    expect(await getCurrentUser()).toMatchObject({ id: "user-1" });
  });

  it("does not affect an account that never reset its password", async () => {
    userFindUnique.mockResolvedValue(user({ sessionsValidAfter: null }));
    getSession.mockResolvedValue(session(0));
    expect(await getCurrentUser()).toMatchObject({ id: "user-1" });
  });

  it("treats a session from before this feature (start of its second only) as older than a reset in that second", async () => {
    userFindUnique.mockResolvedValue(user({ sessionsValidAfter: RESET }));
    getSession.mockResolvedValue(session(Math.floor(RESET.getTime() / 1000) * 1000)); // pas de `ims` : début de la seconde
    expect(await getCurrentUser()).toBeNull();
  });

  it("keeps the existing rules: no session, unknown, suspended or deleted account", async () => {
    getSession.mockResolvedValue(null);
    expect(await getCurrentUser()).toBeNull();
    expect(userFindUnique).not.toHaveBeenCalled();

    getSession.mockResolvedValue(session(Date.now()));
    userFindUnique.mockResolvedValue(null);
    expect(await getCurrentUser()).toBeNull();
    userFindUnique.mockResolvedValue(user({ suspendedAt: new Date() }));
    expect(await getCurrentUser()).toBeNull();
    userFindUnique.mockResolvedValue(user({ deletedAt: new Date() }));
    expect(await getCurrentUser()).toBeNull();
  });
});
