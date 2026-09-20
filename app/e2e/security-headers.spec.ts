import { test, expect, type Page } from "@playwright/test";

// Lot 134 — en-têtes de sécurité, dans un vrai navigateur : ce que le site envoie, et surtout ce que le navigateur
// REFUSE ensuite de faire. Un test d'en-tête seul prouve qu'une ligne est écrite ; ces tests prouvent qu'elle protège :
// un script injecté dans la page ne s'exécute pas, une image ou une requête vers un autre site est bloquée, le site ne
// peut pas être encadré par un autre. (Serveur de développement : la politique y ajoute 'unsafe-eval' et les WebSockets ;
// la version de production est vérifiée par e2e-pwa/security-headers.spec.ts.)

const FRAME_HOST = "http://localhost:5187"; // le faux Google sert de « site d'un tiers » (autre origine)
const GIF = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

// Note les violations de la politique, pour que le test les lise (le navigateur les signale aussi dans la console).
async function recordViolations(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __violations: string[] }).__violations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as unknown as { __violations: string[] }).__violations.push(`${event.effectiveDirective} ${event.blockedURI || "inline"}`.trim());
    });
  });
}
const violationsOf = (page: Page) => page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);

const policyOf = (headers: Record<string, string>) => headers["content-security-policy"] ?? "";

test.describe("en-têtes envoyés", () => {
  test("les pages, l'API et les fichiers portent les en-têtes de sécurité fixes ; le site ne dit pas de quoi il est fait", async ({ request }) => {
    for (const path of ["/fr", "/ar/recherche", "/fr/cette-page-nexiste-pas", "/api/health", "/manifest.webmanifest", "/sw.js", "/robots.txt", "/sitemap.xml"]) {
      const response = await request.get(path);
      const h = response.headers();
      expect(h["x-content-type-options"], path).toBe("nosniff");
      expect(h["x-frame-options"], path).toBe("DENY");
      expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
      expect(h["permissions-policy"], path).toContain("geolocation=()");
      expect(h["cross-origin-opener-policy"], path).toBe("same-origin-allow-popups");
      expect(h["x-powered-by"], `${path} : « X-Powered-By » ne doit plus être envoyé`).toBeUndefined();
      // HSTS n'a de sens qu'en production (https) : jamais émis par le serveur de développement.
      expect(h["strict-transport-security"], path).toBeUndefined();
    }
  });

  test("la politique de sécurité des contenus est sur les pages (y compris « introuvable »), pas sur l'API ni sur les fichiers", async ({ request }) => {
    for (const path of ["/fr", "/ar/guides", "/fr/cette-page-nexiste-pas", "/fr/connexion"]) {
      const policy = policyOf((await request.get(path)).headers());
      expect(policy, path).toContain("script-src 'self' 'nonce-");
      expect(policy, path).toContain("frame-ancestors 'none'");
      expect(policy, path).toContain("object-src 'none'");
      expect(policy, path).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    }
    for (const path of ["/api/health", "/manifest.webmanifest", "/robots.txt"]) {
      expect(policyOf((await request.get(path)).headers()), path).toBe("");
    }
  });

  test("le nonce de l'en-tête est celui de TOUS les scripts exécutables de la page, et change à chaque requête", async ({ request }) => {
    const read = async () => {
      const response = await request.get("/fr/recherche");
      const nonce = /'nonce-([^']+)'/.exec(policyOf(response.headers()))![1];
      const html = await response.text();
      const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]).filter((tag) => !tag.includes("application/ld+json"));
      return { nonce, scripts };
    };
    const first = await read();
    const second = await read();

    expect(first.scripts.length).toBeGreaterThan(5);
    for (const tag of first.scripts) expect(tag, "un script sans le nonce de sa page ne s'exécuterait pas").toContain(`nonce="${first.nonce}"`);
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.nonce.length).toBeGreaterThanOrEqual(22);
  });

  test("un en-tête de politique ou de nonce envoyé par le visiteur n'est jamais repris", async ({ request }) => {
    const response = await request.get("/fr", { headers: { "content-security-policy": "script-src * 'unsafe-inline'", "content-security-policy-report-only": "default-src *", "x-nonce": "nonce-du-pirate" } });
    const headers = response.headers();
    expect(policyOf(headers)).toContain("script-src 'self' 'nonce-");
    expect(policyOf(headers)).not.toContain("*");
    expect(policyOf(headers)).not.toContain("nonce-du-pirate");
    expect(headers["content-security-policy-report-only"]).toBeUndefined();
    expect(await response.text()).not.toContain("nonce-du-pirate");
  });
});

test.describe("ce que le navigateur refuse", () => {
  test("le site s'affiche et fonctionne normalement sous la politique (aucune violation sur les pages usuelles)", async ({ page }) => {
    await recordViolations(page);
    for (const path of ["/fr", "/fr/recherche", "/ar/voitures", "/fr/guides", "/fr/connexion"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await violationsOf(page), path).toEqual([]);
    }
    // Interaction réelle : un filtre de la recherche (JavaScript de la page, donc scripts autorisés par le nonce).
    await page.goto("/fr/recherche");
    await page.locator("#filter-category").selectOption("DEUX_ROUES");
    await expect(page.locator("#filter-category")).toHaveValue("DEUX_ROUES");
  });

  test("un script inséré dans le code de la page ne s'exécute pas (injection XSS simulée sur une vraie page)", async ({ page }) => {
    await recordViolations(page);
    // Simule une faille XSS : le serveur renverrait, dans la page, du HTML fourni par un attaquant.
    await page.route("**/fr/guides", async (route) => {
      const response = await route.fetch();
      const injected = `<script>window.__pwned_script = true</script>
        <img src="${GIF}" onload="window.__pwned_onload = true" onerror="window.__pwned_onerror = true">
        <a id="piege" href="javascript:window.__pwned_url = true">cliquez</a>`;
      await route.fulfill({ response, body: (await response.text()).replace("</body>", `${injected}</body>`) });
    });
    await page.goto("/fr/guides");
    await page.locator("#piege").click();
    await page.waitForTimeout(500);

    const executed = await page.evaluate(() => Object.keys(window).filter((key) => key.startsWith("__pwned")));
    expect(executed, "rien de ce qui a été injecté ne doit s'être exécuté").toEqual([]);
    const violations = await violationsOf(page);
    expect(violations.some((v) => v.startsWith("script-src-elem"))).toBe(true); // le <script> injecté
    expect(violations.some((v) => v.startsWith("script-src-attr"))).toBe(true); // les gestionnaires onload / onerror
    // La page injectée reste utilisable : seul ce qui a été injecté est refusé.
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("une image, une requête ou un cadre vers un autre site sont refusés", async ({ page }) => {
    await recordViolations(page);
    await page.goto("/fr");
    const result = await page.evaluate(async () => {
      const image = document.createElement("img");
      image.src = "https://exemple-externe.invalid/pixel.png";
      document.body.appendChild(image);
      const frame = document.createElement("iframe");
      frame.src = "https://exemple-externe.invalid/";
      document.body.appendChild(frame);
      return fetch("https://exemple-externe.invalid/donnees").then(() => "reçu", () => "bloqué");
    });
    await page.waitForTimeout(500);
    expect(result).toBe("bloqué");
    const violations = (await violationsOf(page)).join(" | ");
    expect(violations).toContain("img-src https://exemple-externe.invalid");
    expect(violations).toContain("connect-src https://exemple-externe.invalid");
    expect(violations).toContain("frame-src https://exemple-externe.invalid");
  });

  test("le site ne peut pas être affiché dans un cadre par un autre site (clickjacking)", async ({ page }) => {
    await page.goto(`${FRAME_HOST}/__frame?src=${encodeURIComponent("http://localhost:5185/fr/connexion")}`);
    await expect(page.locator("#hote")).toBeVisible();
    await page.waitForTimeout(1500);

    const child = page.frames().find((frame) => frame !== page.mainFrame());
    expect(child, "le cadre existe dans la page de l'autre site").toBeDefined();
    // Le navigateur refuse d'y charger la page : le cadre affiche une page d'erreur, jamais le formulaire de connexion.
    expect(child!.url()).not.toContain("/fr/connexion");
    expect(await child!.locator("#login-email").count()).toBe(0);
    expect(await child!.locator("text=Se connecter").count()).toBe(0);

    // Même page ouverte normalement : elle fonctionne.
    await page.goto("/fr/connexion");
    await expect(page.locator("#login-email")).toBeVisible();
  });

  test("les fonctions du navigateur que le site n'utilise pas lui sont interdites (géolocalisation, caméra, micro)", async ({ page }) => {
    await page.goto("/fr");
    const allowed = await page.evaluate(() => {
      const policy = (document as unknown as { featurePolicy?: { allowsFeature(name: string): boolean } }).featurePolicy;
      return policy ? { geolocation: policy.allowsFeature("geolocation"), camera: policy.allowsFeature("camera"), microphone: policy.allowsFeature("microphone") } : null;
    });
    expect(allowed).toEqual({ geolocation: false, camera: false, microphone: false });
  });

  test("la fenêtre WhatsApp ouverte par le site fonctionne malgré l'isolation des fenêtres (Cross-Origin-Opener-Policy)", async ({ page }) => {
    await page.goto("/fr");
    const popupPromise = page.waitForEvent("popup");
    await page.evaluate(() => {
      (window as unknown as { __popup: Window | null }).__popup = window.open("about:blank", "_blank");
    });
    const popup = await popupPromise;
    // Le site garde la main sur la fenêtre qu'il a ouverte (il y envoie ensuite le lien WhatsApp).
    const kept = await page.evaluate(() => {
      const popup = (window as unknown as { __popup: Window | null }).__popup;
      return Boolean(popup && !popup.closed);
    });
    expect(kept).toBe(true);
    await popup.close();
  });
});

test.describe("rapports de violation", () => {
  test("le navigateur envoie un rapport quand la politique bloque quelque chose, et la route l'accepte sans rien renvoyer", async ({ page }) => {
    const reportRequest = page.waitForRequest((request) => request.url().includes("/api/security/csp-report") && request.method() === "POST");
    await page.goto("/fr");
    await page.evaluate(() => {
      const image = document.createElement("img");
      image.src = "https://exemple-externe.invalid/pixel.png";
      document.body.appendChild(image);
    });
    const sent = await reportRequest;
    expect(sent.headers()["content-type"]).toMatch(/csp-report|reports\+json/);
    expect(sent.postData()).toContain("exemple-externe.invalid");
  });

  test("la route répond toujours 204, quoi qu'on lui envoie, et n'accepte que POST", async ({ request }) => {
    const legacy = JSON.stringify({ "csp-report": { "document-uri": "https://souqauto.dz/fr", "effective-directive": "img-src", "blocked-uri": "https://evil.example/a.png" } });
    for (const [body, type] of [
      [legacy, "application/csp-report"],
      [JSON.stringify([{ type: "csp-violation", body: { documentURL: "https://souqauto.dz/fr", effectiveDirective: "img-src", blockedURL: "inline" } }]), "application/reports+json"],
      ["pas du json", "application/json"],
      ["", "application/json"],
      ["x".repeat(20_000), "application/json"],
      [legacy.replace("evil.example", "chrome-extension://abc"), "application/csp-report"],
    ] as const) {
      const response = await request.post("/api/security/csp-report", { data: body, headers: { "content-type": type } });
      expect(response.status(), body.slice(0, 30)).toBe(204);
      expect(await response.text()).toBe("");
    }
    expect((await request.get("/api/security/csp-report")).status()).toBe(405);
  });
});
