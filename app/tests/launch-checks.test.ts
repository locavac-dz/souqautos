import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { evaluateLaunchReadiness, summarizeChecks, type LaunchFacts } from "@/lib/launch-checks";

const goodFacts: LaunchFacts = { dbReachable: true, adminUsesDevPassword: false, demoAccounts: 0, migrationsOnDisk: 8, migrationsApplied: 8 };
const key = Buffer.alloc(32, 7).toString("base64");
// Paire VAPID valide, créée à la volée (jamais une clé réelle dans le dépôt).
function makeVapidPair() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const priv = privateKey.export({ format: "jwk" }).d as string;
  const pubJwk = publicKey.export({ format: "jwk" });
  const pub = Buffer.concat([Buffer.from([4]), Buffer.from(pubJwk.x as string, "base64url"), Buffer.from(pubJwk.y as string, "base64url")]).toString("base64url");
  return { publicKey: pub, privateKey: priv };
}
const vapid = makeVapidPair();
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
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: "mailto:contact@souqauto.example",
  GOOGLE_SITE_VERIFICATION: "abcDEF1234567890_-abcDEF1234567890",
  GOOGLE_CLIENT_ID: "123456789-abcdef.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "secret-de-test",
  OPS_ALERT_EMAILS: "technique@souqauto.example",
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

  it("warns, without blocking, when push notifications are not configured", () => {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, ...noPush } = goodEnv;
    void VAPID_PUBLIC_KEY; void VAPID_PRIVATE_KEY; void VAPID_SUBJECT;
    const results = evaluateLaunchReadiness({ env: noPush, facts: goodFacts });
    expect(level(results, "push")).toEqual(["warning"]);
    expect(summarizeChecks(results)).toMatchObject({ errors: 0, warnings: 1, ready: true });
  });

  it("blocks on half-configured or malformed VAPID keys", () => {
    const { VAPID_PRIVATE_KEY, ...onlyPublic } = goodEnv;
    void VAPID_PRIVATE_KEY;
    expect(level(evaluateLaunchReadiness({ env: onlyPublic, facts: goodFacts }), "push")).toEqual(["error"]);
    expect(level(evaluateLaunchReadiness({ env: { ...goodEnv, VAPID_PUBLIC_KEY: "trop-court" }, facts: goodFacts }), "push")).toEqual(["error"]);
    expect(level(evaluateLaunchReadiness({ env: { ...goodEnv, VAPID_SUBJECT: "contact" }, facts: goodFacts }), "push")).toEqual(["error"]);
  });

  it("blocks when the private key does not belong to the public key (every send would be refused)", () => {
    const other = makeVapidPair();
    const results = evaluateLaunchReadiness({ env: { ...goodEnv, VAPID_PRIVATE_KEY: other.privateKey }, facts: goodFacts });
    expect(level(results, "push")).toEqual(["error"]);
    expect(results.find((r) => r.id === "push")?.message).toContain("ne correspond pas");
  });
});

describe("evaluateLaunchReadiness — alertes techniques (Lot 136)", () => {
  const { OPS_ALERT_EMAILS, ...withoutAlerts } = goodEnv;
  void OPS_ALERT_EMAILS;

  it("is fine when technical alerts have a recipient, and says how many", () => {
    const results = evaluateLaunchReadiness({ env: goodEnv, facts: goodFacts });
    expect(level(results, "ops-alerts")).toEqual(["ok"]);
    expect(results.find((r) => r.id === "ops-alerts")?.message).toContain("1 adresse");
  });

  it("warns, without blocking, when nobody would be told about a failed backup or a server error", () => {
    const results = evaluateLaunchReadiness({ env: withoutAlerts, facts: goodFacts });
    expect(level(results, "ops-alerts")).toEqual(["warning"]);
    expect(results.find((r) => r.id === "ops-alerts")?.fix).toContain("OPS_ALERT_EMAILS");
    expect(summarizeChecks(results)).toMatchObject({ errors: 0, warnings: 1, ready: true });
  });

  it("falls back to the moderation team's addresses, and ignores malformed ones", () => {
    expect(level(evaluateLaunchReadiness({ env: { ...withoutAlerts, STAFF_ALERT_EMAILS: "equipe@souqauto.example" }, facts: goodFacts }), "ops-alerts")).toEqual(["ok"]);
    expect(level(evaluateLaunchReadiness({ env: { ...withoutAlerts, OPS_ALERT_EMAILS: "pas-une-adresse, @x" }, facts: goodFacts }), "ops-alerts")).toEqual(["warning"]);
  });
});

describe("evaluateLaunchReadiness — politique de sécurité (Lot 134)", () => {
  it("is fine by default: the policy is enforced", () => {
    expect(level(evaluateLaunchReadiness({ env: goodEnv, facts: goodFacts }), "csp")).toEqual(["ok"]);
    expect(level(evaluateLaunchReadiness({ env: { ...goodEnv, CSP_REPORT_ONLY: "0" }, facts: goodFacts }), "csp")).toEqual(["ok"]);
  });

  it("warns, without blocking, when the policy is left in observation mode (it blocks nothing there)", () => {
    const results = evaluateLaunchReadiness({ env: { ...goodEnv, CSP_REPORT_ONLY: "1" }, facts: goodFacts });
    expect(level(results, "csp")).toEqual(["warning"]);
    expect(results.find((r) => r.id === "csp")?.fix).toContain("CSP_REPORT_ONLY");
    expect(summarizeChecks(results)).toMatchObject({ errors: 0, warnings: 1, ready: true });
  });
});

describe("evaluateLaunchReadiness — Search Console (Lot 124)", () => {
  const withoutCode = () => {
    const { GOOGLE_SITE_VERIFICATION, ...rest } = goodEnv;
    void GOOGLE_SITE_VERIFICATION;
    return rest;
  };

  it("warns, without blocking, when no Search Console verification code is set", () => {
    const results = evaluateLaunchReadiness({ env: withoutCode(), facts: goodFacts });
    expect(level(results, "search-console")).toEqual(["warning"]);
    expect(summarizeChecks(results)).toMatchObject({ errors: 0, warnings: 1, ready: true });
  });

  it("warns when the value is not a token (a whole <meta> tag pasted by mistake would not be published)", () => {
    const results = evaluateLaunchReadiness({ env: { ...withoutCode(), GOOGLE_SITE_VERIFICATION: '<meta name="google-site-verification" content="abc">' }, facts: goodFacts });
    expect(level(results, "search-console")).toEqual(["warning"]);
    expect(results.find((r) => r.id === "search-console")?.fix).toBeTruthy();
  });

  it("is fine with a valid code", () => {
    expect(level(evaluateLaunchReadiness({ env: goodEnv, facts: goodFacts }), "search-console")).toEqual(["ok"]);
  });

  describe("connexion avec Google (Lot 132)", () => {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ...withoutGoogle } = goodEnv;
    void GOOGLE_CLIENT_ID;
    void GOOGLE_CLIENT_SECRET;

    it("is ready when the identifier and the secret are both set, and shows the exact redirect address to declare", () => {
      const results = evaluateLaunchReadiness({ env: goodEnv, facts: goodFacts });
      expect(level(results, "google-login")).toEqual(["ok"]);
      expect(results.find((r) => r.id === "google-login")?.message).toContain("https://souqauto.example/api/auth/google/callback");
    });

    it("only warns when the feature is left off (it is optional)", () => {
      const results = evaluateLaunchReadiness({ env: withoutGoogle, facts: goodFacts });
      expect(level(results, "google-login")).toEqual(["warning"]);
      expect(summarizeChecks(results).ready).toBe(true);
    });

    it("blocks the launch when only one of the two variables is set", () => {
      expect(level(evaluateLaunchReadiness({ env: { ...withoutGoogle, GOOGLE_CLIENT_ID: "x.apps.googleusercontent.com" }, facts: goodFacts }), "google-login")).toEqual(["error"]);
      const noId = evaluateLaunchReadiness({ env: { ...withoutGoogle, GOOGLE_CLIENT_SECRET: "s" }, facts: goodFacts });
      expect(level(noId, "google-login")).toEqual(["error"]);
      expect(summarizeChecks(noId).ready).toBe(false);
    });

    it("warns about an identifier that does not look like Google's", () => {
      const results = evaluateLaunchReadiness({ env: { ...goodEnv, GOOGLE_CLIENT_ID: "mon-identifiant" }, facts: goodFacts });
      expect(level(results, "google-login")).toEqual(["warning"]);
    });

    it("ignores the test-only replacement of Google's addresses when judging as production", () => {
      const results = evaluateLaunchReadiness({ env: { ...goodEnv, GOOGLE_OAUTH_TEST_BASE_URL: "http://localhost:5187" }, facts: goodFacts });
      expect(level(results, "google-login")).toEqual(["ok"]);
    });
  });
});
