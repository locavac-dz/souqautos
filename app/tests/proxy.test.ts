import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

// Lot 134 — le proxy fabrique la politique de sécurité des contenus de chaque page. Next.js transmet à l'application les
// en-têtes de requête que le proxy déclare « remplacés » (x-middleware-override-headers / x-middleware-request-*) : on lit
// donc, sur la réponse, exactement ce que l'application recevra.

const REQUEST_PREFIX = "x-middleware-request-";
const forwarded = (response: Response, name: string) => response.headers.get(`${REQUEST_PREFIX}${name}`);
const call = (headers: Record<string, string> = {}) => proxy(new NextRequest("http://localhost:5184/fr/recherche", { headers }));
const nonceOf = (policy: string | null) => /'nonce-([^']+)'/.exec(policy ?? "")?.[1];

afterEach(() => vi.unstubAllEnvs());

describe("proxy — en-têtes de politique de sécurité", () => {
  it("envoie la politique sur la réponse et la transmet à l'application avec le même nonce", () => {
    const response = call();
    const policy = response.headers.get("content-security-policy");
    expect(policy).toContain("script-src 'self' 'nonce-");
    expect(nonceOf(forwarded(response, "content-security-policy"))).toBe(nonceOf(policy));
    expect(response.headers.get("content-security-policy-report-only")).toBeNull();
  });

  it("change de nonce à chaque requête", () => {
    expect(nonceOf(call().headers.get("content-security-policy"))).not.toBe(nonceOf(call().headers.get("content-security-policy")));
  });

  it("ne reprend jamais la politique d'un visiteur : la sienne n'atteint pas l'application", () => {
    const response = call({ "content-security-policy": "script-src * 'nonce-pirate'", "content-security-policy-report-only": "default-src *" });
    const policy = response.headers.get("content-security-policy");
    expect(policy).not.toContain("pirate");
    expect(forwarded(response, "content-security-policy")).toBe(policy);
    expect(forwarded(response, "content-security-policy-report-only")).toBeNull();
  });

  it("en mode observation, seule la version « observation » existe, y compris pour l'application (le nonce du visiteur n'est pas lu)", () => {
    vi.stubEnv("CSP_REPORT_ONLY", "1");
    const response = call({ "content-security-policy": "script-src 'nonce-pirate'" });
    const policy = response.headers.get("content-security-policy-report-only");
    expect(policy).toContain("script-src 'self' 'nonce-");
    expect(response.headers.get("content-security-policy")).toBeNull();
    // Sans le retrait de l'en-tête du visiteur, Next.js lirait SON nonce (l'en-tête « enforced » est lu en premier).
    expect(forwarded(response, "content-security-policy")).toBeNull();
    expect(nonceOf(forwarded(response, "content-security-policy-report-only"))).toBe(nonceOf(policy));
  });
});

describe("proxy — requêtes /api (vérification CSRF d'origine)", () => {
  const api = (method: string, headers: Record<string, string> = {}) =>
    proxy(new NextRequest("http://localhost:5184/api/listings", { method, headers }));

  it("refuse une requête mutatrice venue d'une autre origine, sans politique de contenu ni routage de langue", () => {
    const response = api("POST", { origin: "http://evil.com" });
    expect(response.status).toBe(403);
    expect(response.headers.get("content-security-policy")).toBeNull();
  });

  it("laisse passer une requête de même origine sans la réécrire vers une page localisée", () => {
    const response = api("POST", { origin: "http://localhost:5184" });
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("content-security-policy")).toBeNull();
  });

  it("n'applique pas la vérification CSRF aux pages", () => {
    const response = proxy(new NextRequest("http://localhost:5184/fr/recherche", { method: "POST", headers: { origin: "http://evil.com" } }));
    expect(response.status).not.toBe(403);
  });
});
