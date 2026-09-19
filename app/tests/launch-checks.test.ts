import { describe, expect, it } from "vitest";
import { evaluateLaunchReadiness, summarizeChecks, type LaunchFacts } from "@/lib/launch-checks";

const goodFacts: LaunchFacts = { dbReachable: true, adminUsesDevPassword: false, demoAccounts: 0, migrationsOnDisk: 8, migrationsApplied: 8 };
const key = Buffer.alloc(32, 7).toString("base64");
const goodEnv = {
  JWT_SECRET: "a".repeat(48),
  ENCRYPTION_KEY: key,
  DATABASE_URL: "postgresql://souq:Vr4y-Str0ng-Pass@db.internal:5432/souq_auto",
  NEXT_PUBLIC_SITE_URL: "https://souqauto.example",
  SMTP_HOST: "smtp.example.org",
  SMTP_USER: "u",
  SMTP_PASS: "p",
  SMTP_FROM: "Souq Auto <contact@souqauto.example>",
  TRUSTED_PROXY_HOPS: "1",
  REDIS_URL: "redis://redis.internal:6379",
  S3_BUCKET: "souq-auto-photos",
};

const level = (results: ReturnType<typeof evaluateLaunchReadiness>, id: string) => results.filter((r) => r.id === id).map((r) => r.level);

describe("evaluateLaunchReadiness", () => {
  it("reports a fully configured production as ready with nothing to warn about", () => {
    const results = evaluateLaunchReadiness({ env: goodEnv, facts: goodFacts });
    expect(summarizeChecks(results)).toMatchObject({ errors: 0, warnings: 0, ready: true });
  });

  it("blocks a launch with the example configuration", () => {
    const env = { JWT_SECRET: "change-me-in-production", ENCRYPTION_KEY: "change-me-in-production", DATABASE_URL: "postgresql://souq_auto:change-me@localhost:5432/souq_auto", NEXT_PUBLIC_SITE_URL: "http://localhost:5184" };
    const results = evaluateLaunchReadiness({ env, facts: goodFacts });
    for (const id of ["jwt", "encryption", "database-password", "site-url", "mail", "proxy"]) {
      expect(level(results, id), id).toContain("error");
    }
    expect(summarizeChecks(results).ready).toBe(false);
  });

  it("rejects short or malformed secrets", () => {
    const results = evaluateLaunchReadiness({ env: { ...goodEnv, JWT_SECRET: "trop-court", ENCRYPTION_KEY: "pas-32-octets" }, facts: goodFacts });
    expect(level(results, "jwt")).toContain("error");
    expect(level(results, "encryption")).toContain("error");
  });

  it("requires an https public address that is not local", () => {
    expect(level(evaluateLaunchReadiness({ env: { ...goodEnv, NEXT_PUBLIC_SITE_URL: "http://souqauto.example" }, facts: goodFacts }), "site-url")).toContain("error");
    expect(level(evaluateLaunchReadiness({ env: { ...goodEnv, NEXT_PUBLIC_SITE_URL: "https://localhost:5184" }, facts: goodFacts }), "site-url")).toContain("error");
    expect(level(evaluateLaunchReadiness({ env: { ...goodEnv, NEXT_PUBLIC_SITE_URL: "pas une adresse" }, facts: goodFacts }), "site-url")).toContain("error");
  });

  it("treats a missing SMTP host as blocking, and the default sender as a warning", () => {
    const { SMTP_HOST, ...withoutSmtp } = goodEnv;
    void SMTP_HOST;
    expect(level(evaluateLaunchReadiness({ env: withoutSmtp, facts: goodFacts }), "mail")).toContain("error");
    const { SMTP_FROM, ...defaultSender } = goodEnv;
    void SMTP_FROM;
    expect(level(evaluateLaunchReadiness({ env: defaultSender, facts: goodFacts }), "mail-from")).toContain("warning");
  });

  it("blocks when the client address cannot be trusted, warns about missing Redis and S3", () => {
    const { TRUSTED_PROXY_HOPS, REDIS_URL, S3_BUCKET, ...rest } = goodEnv;
    void TRUSTED_PROXY_HOPS; void REDIS_URL; void S3_BUCKET;
    const results = evaluateLaunchReadiness({ env: rest, facts: goodFacts });
    expect(level(results, "proxy")).toContain("error");
    expect(level(results, "redis")).toContain("warning");
    expect(level(results, "storage")).toContain("warning");
    expect(summarizeChecks(results)).toMatchObject({ errors: 1, warnings: 2, ready: false });
  });

  it("warns, without blocking, when the database is on the local machine", () => {
    const results = evaluateLaunchReadiness({ env: { ...goodEnv, DATABASE_URL: "postgresql://souq:Vr4y-Str0ng-Pass@localhost:5433/souq_auto" }, facts: goodFacts });
    expect(level(results, "database-host")).toContain("warning");
    expect(summarizeChecks(results).ready).toBe(true);
  });

  it("blocks on the published admin password and on demonstration data", () => {
    const results = evaluateLaunchReadiness({ env: goodEnv, facts: { ...goodFacts, adminUsesDevPassword: true, demoAccounts: 7 } });
    expect(level(results, "admin-password")).toContain("error");
    expect(level(results, "demo-data")).toContain("error");
    const demo = results.find((r) => r.id === "demo-data");
    expect(demo?.message).toContain("7");
  });

  it("blocks on pending migrations and on an unreachable database", () => {
    expect(level(evaluateLaunchReadiness({ env: goodEnv, facts: { ...goodFacts, migrationsApplied: 6 } }), "migrations")).toContain("error");
    const down = evaluateLaunchReadiness({ env: goodEnv, facts: { ...goodFacts, dbReachable: false } });
    expect(level(down, "database")).toContain("error");
    expect(level(down, "migrations")).toEqual([]); // rien à dire des migrations si la base ne répond pas
  });

  it("gives a remedy for every problem it reports", () => {
    const results = evaluateLaunchReadiness({ env: {}, facts: { ...goodFacts, adminUsesDevPassword: true, demoAccounts: 1, migrationsApplied: 1 } });
    for (const r of results.filter((x) => x.level !== "ok")) {
      expect(r.fix, r.id).toBeTruthy();
    }
  });
});
