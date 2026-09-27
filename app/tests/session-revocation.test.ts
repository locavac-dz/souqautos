import { beforeEach, describe, expect, it, vi } from "vitest";

const redisClient = vi.fn<() => null | { set: ReturnType<typeof vi.fn>; exists: ReturnType<typeof vi.fn> }>(() => null);
vi.mock("@/lib/redis", () => ({ getRedisClient: () => redisClient() }));

import { isSessionRevoked, resetSessionRevocationForTests, revokeSession } from "@/lib/auth-server/session-revocation";

const NOW = Date.parse("2026-09-27T20:00:00Z");
const IN_7_DAYS = NOW + 7 * 24 * 3600 * 1000;

beforeEach(() => {
  resetSessionRevocationForTests();
  redisClient.mockReturnValue(null);
});

describe("révocation des sessions à la déconnexion (Lot 229) — repli mémoire", () => {
  it("une session révoquée est refusée jusqu'à l'expiration de son jeton, puis oubliée", async () => {
    await revokeSession("jti-1", IN_7_DAYS, NOW);
    expect(await isSessionRevoked("jti-1", NOW)).toBe(true);
    expect(await isSessionRevoked("jti-1", IN_7_DAYS - 1)).toBe(true);
    expect(await isSessionRevoked("jti-1", IN_7_DAYS)).toBe(false);
  });

  it("une session jamais révoquée, ou une autre session du même compte, reste acceptée", async () => {
    await revokeSession("jti-1", IN_7_DAYS, NOW);
    expect(await isSessionRevoked("jti-2", NOW)).toBe(false);
  });

  it("un jeton déjà expiré n'est pas retenu (rien à révoquer)", async () => {
    await revokeSession("jti-old", NOW - 1, NOW);
    expect(await isSessionRevoked("jti-old", NOW)).toBe(false);
  });
});

describe("révocation des sessions — Redis quand il est configuré", () => {
  it("inscrit le jeton avec une durée de vie égale au reste de validité, et le lit dans Redis", async () => {
    const set = vi.fn().mockResolvedValue("OK");
    const exists = vi.fn().mockResolvedValue(1);
    redisClient.mockReturnValue({ set, exists });

    await revokeSession("jti-r", IN_7_DAYS, NOW);
    expect(set).toHaveBeenCalledWith("session:revoked:jti-r", "1", "PX", IN_7_DAYS - NOW);
    expect(await isSessionRevoked("jti-r", NOW)).toBe(true);
    expect(exists).toHaveBeenCalledWith("session:revoked:jti-r");
  });

  it("Redis injoignable : la révocation retombe en mémoire et reste appliquée", async () => {
    const failing = { set: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")), exists: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) };
    redisClient.mockReturnValue(failing);
    const silenced = vi.spyOn(console, "error").mockImplementation(() => {});

    await revokeSession("jti-f", IN_7_DAYS, NOW);
    expect(await isSessionRevoked("jti-f", NOW)).toBe(true);
    expect(await isSessionRevoked("jti-other", NOW)).toBe(false);
    silenced.mockRestore();
  });
});
