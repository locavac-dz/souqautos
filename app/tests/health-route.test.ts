import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
const ping = vi.fn();
let redisClient: { ping: typeof ping } | null = null;

vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: (...args: unknown[]) => queryRaw(...args) } }));
vi.mock("@/lib/redis", () => ({ getRedisClient: () => redisClient }));

import { GET } from "@/app/api/health/route";

beforeEach(() => {
  queryRaw.mockReset();
  ping.mockReset();
  redisClient = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/health", () => {
  it("answers 200 when the database answers, and says Redis is absent when not configured", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", checks: { database: "ok", redis: "absent" } });
  });

  it("answers 503 when the database is down, without leaking the error", async () => {
    queryRaw.mockRejectedValue(new Error("password authentication failed for user souq_auto at db.internal"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ status: "degraded", checks: { database: "error", redis: "absent" } });
    expect(JSON.stringify(body)).not.toContain("password");
    expect(JSON.stringify(body)).not.toContain("db.internal");
  });

  it("does not fail the check when only Redis is down (the app falls back to in-memory limits)", async () => {
    queryRaw.mockResolvedValue([{}]);
    redisClient = { ping };
    ping.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).checks).toEqual({ database: "ok", redis: "error" });
  });

  it("reports Redis as ok when it answers", async () => {
    queryRaw.mockResolvedValue([{}]);
    redisClient = { ping };
    ping.mockResolvedValue("PONG");
    expect((await (await GET()).json()).checks.redis).toBe("ok");
  });

  it("is never cached", async () => {
    queryRaw.mockResolvedValue([{}]);
    expect((await GET()).headers.get("cache-control")).toBe("no-store");
  });
});
