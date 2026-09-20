import { describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import {
  GOOGLE_FLOW_COOKIE,
  GoogleExchangeError,
  buildAuthorizationUrl,
  decodeIdTokenClaims,
  exchangeCodeForIdToken,
  isGoogleLoginEnabled,
  openFlow,
  pickLoginLocale,
  pkceChallenge,
  randomToken,
  resolveGoogleConfig,
  safeEqual,
  sanitizeNextPath,
  sealFlow,
  validateIdTokenClaims,
  type GoogleFlow,
  type GoogleOAuthConfig,
} from "@/lib/google-oauth";

const SITE = "https://souqauto.example";
const ENV = { GOOGLE_CLIENT_ID: "123-abc.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "secret-de-test", JWT_SECRET: "j".repeat(48) };
const CONFIG: GoogleOAuthConfig = {
  clientId: ENV.GOOGLE_CLIENT_ID,
  clientSecret: ENV.GOOGLE_CLIENT_SECRET,
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  redirectUri: `${SITE}/api/auth/google/callback`,
};

describe("resolveGoogleConfig", () => {
  it("is disabled without both variables: the button does not appear", () => {
    expect(resolveGoogleConfig({}, SITE)).toEqual({ mode: "disabled" });
    expect(resolveGoogleConfig({ GOOGLE_CLIENT_ID: "  ", GOOGLE_CLIENT_SECRET: "" }, SITE)).toEqual({ mode: "disabled" });
    expect(isGoogleLoginEnabled({}, SITE)).toBe(false);
  });

  it("is a configuration error, never a half-working button, when only one variable is set", () => {
    const noSecret = resolveGoogleConfig({ GOOGLE_CLIENT_ID: "x" }, SITE);
    expect(noSecret).toMatchObject({ mode: "error" });
    expect((noSecret as { reason: string }).reason).toContain("GOOGLE_CLIENT_SECRET");
    const noId = resolveGoogleConfig({ GOOGLE_CLIENT_SECRET: "x" }, SITE);
    expect((noId as { reason: string }).reason).toContain("GOOGLE_CLIENT_ID");
    expect(isGoogleLoginEnabled({ GOOGLE_CLIENT_ID: "x" }, SITE)).toBe(false);
  });

  it("uses Google's real addresses, and a redirect address built from the site address (no double slash)", () => {
    const resolved = resolveGoogleConfig(ENV, `${SITE}/`);
    expect(resolved).toEqual({ mode: "enabled", config: CONFIG });
    expect(isGoogleLoginEnabled(ENV, SITE)).toBe(true);
  });

  it("trims the identifier and the secret", () => {
    const resolved = resolveGoogleConfig({ GOOGLE_CLIENT_ID: "  id  ", GOOGLE_CLIENT_SECRET: " s " }, SITE);
    expect(resolved).toMatchObject({ mode: "enabled", config: { clientId: "id", clientSecret: "s" } });
  });

  it("lets a test replace Google's addresses, but NEVER in production", () => {
    const testEnv = { ...ENV, GOOGLE_OAUTH_TEST_BASE_URL: "http://localhost:5187/" };
    const dev = resolveGoogleConfig({ ...testEnv, NODE_ENV: "development" }, SITE);
    expect(dev).toMatchObject({ mode: "enabled", config: { authUrl: "http://localhost:5187/auth", tokenUrl: "http://localhost:5187/token" } });
    const test = resolveGoogleConfig({ ...testEnv, NODE_ENV: "test" }, SITE);
    expect(test).toMatchObject({ config: { authUrl: "http://localhost:5187/auth" } });
    const prod = resolveGoogleConfig({ ...testEnv, NODE_ENV: "production" }, SITE);
    expect(prod).toMatchObject({ mode: "enabled", config: { authUrl: CONFIG.authUrl, tokenUrl: CONFIG.tokenUrl } });
  });
});

describe("PKCE and random tokens", () => {
  it("computes the S256 challenge of RFC 7636 (appendix B test vector)", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("produces long, URL-safe and different tokens every time", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => randomToken()));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken(64)).toMatch(/^[A-Za-z0-9_-]{86}$/); // vérificateur PKCE : 43 à 128 caractères
  });

  it("compares secrets without throwing on different lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("the sealed flow cookie", () => {
  const flow: GoogleFlow = { state: "s".repeat(43), nonce: "n".repeat(43), verifier: "v".repeat(86), locale: "ar", next: "/compte/favoris" };

  it("round-trips, and nothing else can be read from it", async () => {
    const token = await sealFlow(flow, ENV);
    expect(await openFlow(token, ENV)).toEqual(flow);
  });

  it("rejects a missing, malformed, tampered or wrongly-signed cookie", async () => {
    const token = await sealFlow(flow, ENV);
    expect(await openFlow(undefined, ENV)).toBeNull();
    expect(await openFlow("", ENV)).toBeNull();
    expect(await openFlow("n-importe-quoi", ENV)).toBeNull();
    const [head, body, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), next: "/admin" })).toString("base64url");
    expect(await openFlow(`${head}.${forged}.${signature}`, ENV)).toBeNull();
    expect(await openFlow(token, { ...ENV, JWT_SECRET: "autre-secret-".repeat(5) })).toBeNull();
  });

  it("rejects a session token (no purpose), and a flow token missing a field or with an unknown language", async () => {
    const key = new TextEncoder().encode(ENV.JWT_SECRET);
    const sign = (payload: Record<string, unknown>) => new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(key);
    expect(await openFlow(await sign({ sub: "user-1", role: "ADMIN" }), ENV)).toBeNull();
    expect(await openFlow(await sign({ purpose: "google-oauth-flow", ...flow, locale: "en" }), ENV)).toBeNull();
    expect(await openFlow(await sign({ purpose: "google-oauth-flow", state: "s", nonce: "n", locale: "fr", next: "/" }), ENV)).toBeNull();
    expect(await openFlow(await sign({ purpose: "autre", ...flow }), ENV)).toBeNull();
  });

  it("is refused after its ten minutes", async () => {
    const key = new TextEncoder().encode(ENV.JWT_SECRET);
    const expired = await new SignJWT({ purpose: "google-oauth-flow", ...flow })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key);
    expect(await openFlow(expired, ENV)).toBeNull();
  });

  it("cannot be created without the site secret", async () => {
    await expect(sealFlow(flow, {})).rejects.toThrow(/JWT_SECRET/);
    expect(GOOGLE_FLOW_COOKIE).toBe("souq_auto_google_flow");
  });
});

describe("sanitizeNextPath — no open redirect", () => {
  const fallback = "/compte/tableau-de-bord";

  it("keeps an internal path, and removes the language prefix (it is added back at the end)", () => {
    expect(sanitizeNextPath("/compte/favoris")).toBe("/compte/favoris");
    expect(sanitizeNextPath("/fr/compte/favoris")).toBe("/compte/favoris");
    expect(sanitizeNextPath("/ar/recherche?brandId=3&q=clio")).toBe("/recherche?brandId=3&q=clio");
    expect(sanitizeNextPath("/annonce/cmu123")).toBe("/annonce/cmu123");
  });

  it("falls back to the dashboard for the language root or nothing", () => {
    for (const value of [undefined, null, "", "/", "/fr", "/ar/", "/fr?x=1"]) expect(sanitizeNextPath(value as string | null | undefined), String(value)).toBe(fallback);
  });

  it("refuses every way of leaving the site or reaching the API", () => {
    const attacks = [
      "//evil.example", "//evil.example/x", "https://evil.example", "http://evil.example", "javascript:alert(1)", "data:text/html,x",
      "/\\evil.example", "\\\\evil.example", "/%2F%2Fevil.example/../x", "/../../etc/passwd", "/a/../b", "/api/auth/logout", "/api", "/api/x",
      "/x y", "/x\n/y", "/x\r\nSet-Cookie: a=b", "/<script>", "/x#frag", "/ x", "evil.example", "compte/favoris", "/" + "a".repeat(250),
    ];
    for (const attack of attacks) expect(sanitizeNextPath(attack), JSON.stringify(attack)).toBe(fallback);
  });

  it("only picks a supported language", () => {
    expect(pickLoginLocale("ar")).toBe("ar");
    expect(pickLoginLocale("fr")).toBe("fr");
    for (const value of [null, undefined, "", "en", "AR", "ar ", "../x"]) expect(pickLoginLocale(value)).toBe("fr");
  });
});

describe("buildAuthorizationUrl", () => {
  it("asks for the minimum, with PKCE, a state and a nonce, and never carries the secret", () => {
    const url = new URL(buildAuthorizationUrl(CONFIG, { state: "STATE", nonce: "NONCE", challenge: "CHALLENGE", locale: "ar" }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const p = url.searchParams;
    expect(p.get("client_id")).toBe(ENV.GOOGLE_CLIENT_ID);
    expect(p.get("redirect_uri")).toBe(`${SITE}/api/auth/google/callback`);
    expect(p.get("response_type")).toBe("code");
    expect(p.get("scope")).toBe("openid email profile");
    expect(p.get("state")).toBe("STATE");
    expect(p.get("nonce")).toBe("NONCE");
    expect(p.get("code_challenge")).toBe("CHALLENGE");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("prompt")).toBe("select_account");
    expect(p.get("hl")).toBe("ar");
    expect(url.toString()).not.toContain(ENV.GOOGLE_CLIENT_SECRET);
    expect(url.toString()).not.toContain("code_verifier");
  });
});

describe("decodeIdTokenClaims", () => {
  const jwt = (payload: unknown) => `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.c2ln`;

  it("reads the claims of a three-part token", () => {
    expect(decodeIdTokenClaims(jwt({ sub: "1", email: "a@b.dz" }))).toEqual({ sub: "1", email: "a@b.dz" });
  });

  it("returns null for anything that is not a token with an object payload", () => {
    for (const bad of ["", "abc", "a.b", "a.b.c.d", "a..c", jwt([1, 2]), jwt("texte"), jwt(null), "e30.@@@.c2ln", `e30.${Buffer.from("pas du json").toString("base64url")}.c2ln`]) {
      expect(decodeIdTokenClaims(bad), bad).toBeNull();
    }
  });
});

describe("validateIdTokenClaims", () => {
  const NOW = new Date("2026-09-20T10:00:00Z");
  const nowSeconds = Math.floor(NOW.getTime() / 1000);
  const expected = { clientId: ENV.GOOGLE_CLIENT_ID, nonce: "le-nonce", now: NOW };
  const good = () => ({
    iss: "https://accounts.google.com",
    aud: ENV.GOOGLE_CLIENT_ID,
    exp: nowSeconds + 3600,
    nonce: "le-nonce",
    sub: "1234567890",
    email: "  Amina.Test@Gmail.com ",
    email_verified: true,
    name: "  Amina Test ",
  });
  const refused = (claims: Record<string, unknown>) => {
    const result = validateIdTokenClaims(claims, expected);
    return result.ok ? "accepté" : result.reason;
  };

  it("accepts a complete token, and normalizes the address and the name", () => {
    expect(validateIdTokenClaims(good(), expected)).toEqual({ ok: true, profile: { sub: "1234567890", email: "amina.test@gmail.com", name: "Amina Test" } });
  });

  it("accepts both forms of Google's issuer, and an audience list that names the client (with azp)", () => {
    expect(refused({ ...good(), iss: "accounts.google.com" })).toBe("accepté");
    expect(refused({ ...good(), aud: [ENV.GOOGLE_CLIENT_ID] })).toBe("accepté");
    expect(refused({ ...good(), aud: [ENV.GOOGLE_CLIENT_ID, "autre"], azp: ENV.GOOGLE_CLIENT_ID })).toBe("accepté");
  });

  it("refuses another issuer", () => {
    for (const iss of ["https://evil.example", "https://accounts.google.com.evil.example", "", undefined, 3]) expect(refused({ ...good(), iss }), String(iss)).toBe("issuer");
  });

  it("refuses a token meant for another application", () => {
    for (const aud of ["un-autre-client", "", undefined, [], ["autre"], [ENV.GOOGLE_CLIENT_ID, "autre"]]) expect(refused({ ...good(), aud }), JSON.stringify(aud)).toBe("audience");
  });

  it("refuses an expired or expiry-less token, with 30 seconds of clock tolerance", () => {
    expect(refused({ ...good(), exp: nowSeconds - 31 })).toBe("expired");
    expect(refused({ ...good(), exp: nowSeconds - 3600 })).toBe("expired");
    expect(refused({ ...good(), exp: nowSeconds - 10 })).toBe("accepté");
    expect(refused({ ...good(), exp: undefined })).toBe("expired");
    expect(refused({ ...good(), exp: "9999999999" })).toBe("expired");
  });

  it("refuses a token whose nonce is not the one of this attempt (replay of another login)", () => {
    for (const nonce of ["autre", "", undefined, 7, "le-nonce "]) expect(refused({ ...good(), nonce }), String(nonce)).toBe("nonce");
  });

  it("refuses a missing or absurd subject", () => {
    for (const sub of [undefined, "", 12, "x".repeat(256)]) expect(refused({ ...good(), sub }), String(sub)).toBe("subject");
  });

  it("refuses a missing or malformed address", () => {
    for (const email of [undefined, "", "   ", "sans-arobase", "a@", "@b.dz", "a b@c.dz", "a@b.dz ".repeat(60), 42]) expect(refused({ ...good(), email }), String(email)).toBe("email_missing");
  });

  it("refuses an address Google does not vouch for (otherwise anyone could claim someone else's address)", () => {
    for (const email_verified of [false, "false", undefined, null, 1, "yes"]) expect(refused({ ...good(), email_verified }), String(email_verified)).toBe("email_unverified");
    expect(refused({ ...good(), email_verified: "true" })).toBe("accepté"); // certains jetons l'écrivent en texte
  });

  it("drops an unusable name (missing, too short, too long)", () => {
    for (const name of [undefined, "", "A", " ", "x".repeat(81), 5]) {
      const result = validateIdTokenClaims({ ...good(), name }, expected);
      expect(result.ok && result.profile.name, String(name)).toBeFalsy();
    }
  });
});

describe("exchangeCodeForIdToken", () => {
  const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

  it("sends the code, the PKCE verifier and the secret to the token address, from server to server", async () => {
    const fetchImpl = ok({ id_token: "le.jeton.ici" });
    const token = await exchangeCodeForIdToken(CONFIG, { code: "LE-CODE", verifier: "LE-VERIFICATEUR" }, fetchImpl as unknown as typeof fetch);
    expect(token).toBe("le.jeton.ici");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(CONFIG.tokenUrl);
    expect(url).not.toContain("secret");
    expect(init.method).toBe("POST");
    const form = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(form)).toEqual({
      code: "LE-CODE",
      client_id: CONFIG.clientId,
      client_secret: CONFIG.clientSecret,
      redirect_uri: CONFIG.redirectUri,
      grant_type: "authorization_code",
      code_verifier: "LE-VERIFICATEUR",
    });
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("fails without echoing the response, which may contain the code or the secret", async () => {
    const error = await exchangeCodeForIdToken(CONFIG, { code: "c", verifier: "v" }, ok({ error: "invalid_grant", detail: "SECRET-A-NE-PAS-DIVULGUER" }, 400) as unknown as typeof fetch).catch((e) => e);
    expect(error).toBeInstanceOf(GoogleExchangeError);
    expect(error.message).toContain("400");
    expect(error.message).not.toContain("SECRET");
    expect(error.message).not.toContain(CONFIG.clientSecret);
  });

  it("fails when Google answers without an identity token", async () => {
    for (const body of [{}, { id_token: "" }, { id_token: 12 }, { access_token: "x" }]) {
      await expect(exchangeCodeForIdToken(CONFIG, { code: "c", verifier: "v" }, ok(body) as unknown as typeof fetch), JSON.stringify(body)).rejects.toBeInstanceOf(GoogleExchangeError);
    }
    const notJson = vi.fn(async () => new Response("<html>", { status: 200 }));
    await expect(exchangeCodeForIdToken(CONFIG, { code: "c", verifier: "v" }, notJson as unknown as typeof fetch)).rejects.toBeInstanceOf(GoogleExchangeError);
  });

  it("turns a network failure into a clean error, without the request", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed: https://oauth2.googleapis.com/token client_secret=secret-de-test");
    });
    const error = await exchangeCodeForIdToken(CONFIG, { code: "c", verifier: "v" }, down as unknown as typeof fetch).catch((e) => e);
    expect(error).toBeInstanceOf(GoogleExchangeError);
    expect(error.message).not.toContain("secret-de-test");
  });
});
