import { expect, test, type ConsoleMessage } from "@playwright/test";

// Lot 134 — en-têtes de sécurité sur la VERSION DE PRODUCTION (compilée, servie par `next start`), dans un vrai navigateur.
// Le serveur de développement (e2e/security-headers.spec.ts) assouplit la politique ('unsafe-eval', WebSockets) : seule
// cette version prouve que la politique finale est stricte ET que le site fonctionne avec elle — service worker, hydratation,
// toutes les pages.

const policyOf = (headers: Record<string, string>) => headers["content-security-policy"] ?? "";

test.describe("politique de sécurité en production", () => {
  test("la politique est stricte : ni eval, ni WebSocket, ni script en ligne ; HSTS est envoyé ; aucune ressource externe", async ({ request }) => {
    const response = await request.get("/fr");
    const h = response.headers();
    const policy = policyOf(h);

    expect(policy).toContain("script-src 'self' 'nonce-");
    expect(policy).toContain("'strict-dynamic'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(policy).not.toMatch(/connect-src[^;]*\b(ws|wss):/);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("report-uri /api/security/csp-report");

    // Uniquement des origines du site lui-même, sauf éventuellement le stockage de photos (img-src).
    const others = policy.replace(/img-src[^;]*/, "");
    expect(others).not.toMatch(/https?:\/\//);

    expect(h["strict-transport-security"]).toBe("max-age=31536000; includeSubDomains");
    expect(h["strict-transport-security"]).not.toContain("preload");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("HSTS et les en-têtes fixes sont aussi sur l'API et les fichiers, la politique seulement sur les pages", async ({ request }) => {
    for (const path of ["/api/health", "/manifest.webmanifest", "/sw.js"]) {
      const h = (await request.get(path)).headers();
      expect(h["strict-transport-security"], path).toContain("max-age=31536000");
      expect(h["x-content-type-options"], path).toBe("nosniff");
      expect(policyOf(h), path).toBe("");
    }
  });

  test("le nonce est celui de tous les scripts de la page, il change à chaque requête, et une valeur envoyée par le visiteur est écrasée", async ({ request }) => {
    const read = async (extra: Record<string, string> = {}) => {
      const response = await request.get("/fr/recherche", { headers: extra });
      const nonce = /'nonce-([^']+)'/.exec(policyOf(response.headers()))![1];
      const scripts = [...(await response.text()).matchAll(/<script\b[^>]*>/g)].map((m) => m[0]).filter((tag) => !tag.includes("application/ld+json"));
      return { nonce, scripts };
    };
    const a = await read();
    const b = await read({ "content-security-policy": "script-src *", "x-nonce": "pirate" });
    expect(a.scripts.length).toBeGreaterThan(3);
    for (const tag of a.scripts) expect(tag).toContain(`nonce="${a.nonce}"`);
    for (const tag of b.scripts) expect(tag).toContain(`nonce="${b.nonce}"`);
    expect(a.nonce).not.toBe(b.nonce);
    expect(b.nonce).not.toBe("pirate");
  });

  test("les pages usuelles, en français et en arabe, se chargent et s'hydratent sans la moindre violation de la politique", async ({ page }) => {
    const problems: string[] = [];
    let current = "";
    const NOT_FOUND_PAGE = "/fr/cette-page-nexiste-pas";
    page.on("console", (message: ConsoleMessage) => {
      if (message.type() !== "error") return;
      // Chrome journalise lui-même le code 404 du document demandé : normal pour la page « introuvable », et pour elle seule.
      if (current === NOT_FOUND_PAGE && /Failed to load resource.*404/.test(message.text())) return;
      problems.push(`${current} : ${message.text().slice(0, 200)}`);
    });
    page.on("pageerror", (error) => problems.push(`${current} : exception ${error.message}`));
    await page.addInitScript(() => {
      (window as unknown as { __violations: string[] }).__violations = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        (window as unknown as { __violations: string[] }).__violations.push(`${event.effectiveDirective} ${event.blockedURI || "inline"}`);
      });
    });

    for (const path of ["/fr", "/ar", "/fr/recherche", "/ar/recherche", "/fr/voitures", "/fr/voitures/renault/clio", "/fr/guides", "/fr/mag", "/fr/connexion", "/ar/inscription", "/fr/mot-de-passe-oublie", NOT_FOUND_PAGE]) {
      current = path;
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      // L'hydratation a eu lieu (elle exige les scripts, donc leur nonce) : un champ contrôlé réagit.
      if (path.endsWith("/connexion")) {
        await page.locator("#login-email").fill("test@example.dz");
        await expect(page.locator("#login-email")).toHaveValue("test@example.dz");
      }
      const violations = await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);
      if (violations.length) problems.push(`${path} : violations ${violations.join(", ")}`);
    }
    expect(problems).toEqual([]);
  });

  test("un script ou un gestionnaire injecté dans la page ne s'exécute pas en production non plus", async ({ page }) => {
    await page.route("**/fr/guides", async (route) => {
      const response = await route.fetch();
      const injected = `<script>window.__pwned_script = true</script><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" onload="window.__pwned_onload = true">`;
      await route.fulfill({ response, body: (await response.text()).replace("</body>", `${injected}</body>`) });
    });
    await page.goto("/fr/guides");
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => Object.keys(window).filter((key) => key.startsWith("__pwned")))).toEqual([]);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("le service worker s'installe et contrôle la page malgré la politique (worker-src)", async ({ page }) => {
    await page.goto("/fr");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  });
});
