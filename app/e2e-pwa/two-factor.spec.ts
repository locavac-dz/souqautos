import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";
import { disconnectE2eDb, e2eDb } from "../e2e/db";
import { getE2eDatabaseUrl } from "../e2e/e2e-database";
import { hashPassword } from "../src/lib/auth-server/password";
import { TOTP_STEP_SECONDS, totpCode } from "../src/lib/totp";
import fr from "../messages/fr.json";

// Lot 138 — la double authentification de l'ÉQUIPE, sur la VERSION DE PRODUCTION (compilée, servie par `next start`), là où elle est
// exigée par défaut. Le serveur de développement ne l'exige pas (comptes d'équipe simples pour les tests) : seule cette version
// prouve la règle « un administrateur sans double authentification n'a aucun pouvoir d'équipe », sous la politique de sécurité
// stricte du site (aucun script en ligne), avec les vrais cookies (`secure`, `httpOnly`).
test.afterAll(disconnectE2eDb);
test.setTimeout(60_000);

const PASSWORD = "MotDePasseAdmin2026!";
const T = fr.TwoFactor;
const codeNow = (secret: string, offsetSteps = 0) => totpCode(secret.replace(/\s/g, ""), Date.now() + offsetSteps * TOTP_STEP_SECONDS * 1000);
const randomIp = () => `10.${1 + Math.floor(Math.random() * 253)}.${1 + Math.floor(Math.random() * 253)}.${1 + Math.floor(Math.random() * 253)}`;

// Un compte d'équipe jetable, créé directement en base (mot de passe connu).
async function createStaff(role: "ADMIN" | "MODERATEUR") {
  const email = `pwa-2fa-${role.toLowerCase()}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}@example.dz`;
  const user = await e2eDb().user.create({ data: { email, passwordHash: await hashPassword(PASSWORD), role, emailVerifiedAt: new Date(), profile: { create: { displayName: `Équipe ${role}` } } } });
  return { id: user.id, email };
}

async function apiLogin(page: Page, email: string) {
  const response = await page.request.post("/api/auth/login", { data: { email, password: PASSWORD }, headers: { "x-forwarded-for": randomIp() } });
  expect(response.status()).toBe(200);
  return response.json();
}

async function enableViaApi(page: Page) {
  // Lot 229 : le mot de passe est exigé pour commencer l'activation (sans lui : invalid_password, puis 409 « no_pending »).
  const setup = await (await page.request.post("/api/account/two-factor/setup", { data: { password: PASSWORD } })).json();
  const secret = String(setup.secret).replace(/\s/g, "");
  const enabled = await page.request.post("/api/account/two-factor/enable", { data: { code: codeNow(secret) } });
  expect(enabled.status()).toBe(200);
  return { secret, recoveryCodes: (await enabled.json()).recoveryCodes as string[] };
}

const adminApi = (page: Page) => page.request.post("/api/admin/users/inexistant/two-factor/reset");

test.describe("l'équipe en production", () => {
  test("un administrateur SANS double authentification n'a aucun pouvoir d'équipe ; il les retrouve dès qu'il l'active", async ({ page }) => {
    const admin = await createStaff("ADMIN");
    await apiLogin(page, admin.email);

    // Connecté, mais « effectivement » un simple particulier : ni l'interface, ni l'API d'administration.
    expect((await adminApi(page)).status(), "API d'administration").toBe(403);
    await page.goto("/fr/admin");
    await expect(page, "l'interface d'administration renvoie hors de l'espace").not.toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: fr.Admin.dashboardTitle })).toHaveCount(0);

    // La page « Sécurité du compte » lui explique pourquoi, en tête.
    await page.goto("/fr/compte/securite");
    await expect(page.getByText(T.staffRequired)).toBeVisible();

    await enableViaApi(page);
    expect((await adminApi(page)).status(), "authentifié en tant qu'admin : la route répond « inexistant », plus « interdit »").toBe(404);
    await page.goto("/fr/admin");
    await expect(page.getByRole("heading", { name: fr.Admin.dashboardTitle })).toBeVisible();
    await page.goto("/fr/compte/securite");
    await expect(page.getByText(T.staffRequired)).toHaveCount(0);
  });

  test("un modérateur est soumis à la même règle ; un simple particulier n'est pas concerné", async ({ page, browser }) => {
    const moderator = await createStaff("MODERATEUR");
    await apiLogin(page, moderator.email);
    expect((await page.request.post("/api/admin/users/inexistant/unlock")).status(), "sans double authentification").toBe(403);
    await enableViaApi(page);
    expect((await page.request.post("/api/admin/users/inexistant/unlock")).status(), "avec double authentification").toBe(404);

    const member = await e2eDb().user.create({ data: { email: `pwa-2fa-membre-${Date.now().toString(36)}@example.dz`, passwordHash: await hashPassword(PASSWORD), emailVerifiedAt: new Date(), profile: { create: { displayName: "Membre" } } } });
    const context = await browser.newContext();
    const memberPage = await context.newPage();
    await apiLogin(memberPage, member.email);
    await memberPage.goto("/fr/compte/securite");
    await expect(memberPage.getByText(T.statusOff)).toBeVisible();
    await expect(memberPage.getByText(T.staffRequired), "aucune obligation pour un particulier").toHaveCount(0);
    await context.close();
  });

  test("la connexion d'un administrateur protégé exige le code ; le cookie d'attente est httpOnly, secure, SameSite=Lax et dure cinq minutes", async ({ page, browser }) => {
    const admin = await createStaff("ADMIN");
    await apiLogin(page, admin.email);
    const { secret } = await enableViaApi(page);

    const context = await browser.newContext();
    const other = await context.newPage();
    const login = await other.request.post("/api/auth/login", { data: { email: admin.email, password: PASSWORD }, headers: { "x-forwarded-for": randomIp() } });
    expect((await login.json()).twoFactorRequired).toBe(true);
    const cookies = await context.cookies();
    expect(cookies.map((c) => c.name)).not.toContain("souq_auto_session");
    const pending = cookies.find((c) => c.name === "souq_auto_2fa")!;
    expect(pending).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
    const lifetime = pending.expires - Date.now() / 1000;
    expect(lifetime).toBeGreaterThan(200);
    expect(lifetime).toBeLessThanOrEqual(301);

    expect((await other.request.get("/api/auth/me")).status()).toBe(401);
    const verified = await other.request.post("/api/auth/two-factor/verify", { data: { code: codeNow(secret, 1) } });
    expect(verified.status()).toBe(200);
    const session = (await context.cookies()).find((c) => c.name === "souq_auto_session")!;
    expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax" });
    expect((await context.cookies()).map((c) => c.name)).not.toContain("souq_auto_2fa");
    await context.close();
  });

  test("parcours complet dans le navigateur, sous la politique de sécurité stricte : aucune violation, aucune erreur", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (message: ConsoleMessage) => {
      if (message.type() === "error") problems.push(`console : ${message.text().slice(0, 160)}`);
    });
    page.on("pageerror", (error) => problems.push(`exception : ${error.message}`));
    await page.addInitScript(() => {
      (window as unknown as { __violations: string[] }).__violations = [];
      document.addEventListener("securitypolicyviolation", (event) => (window as unknown as { __violations: string[] }).__violations.push(`${event.effectiveDirective} ${event.blockedURI || "inline"}`));
    });

    const admin = await createStaff("ADMIN");
    await page.goto("/fr/connexion");
    await page.locator("#login-email").fill(admin.email);
    await page.locator("#login-password").fill(PASSWORD);
    await page.locator("#login-email").locator("xpath=//ancestor::form").locator("button[type=submit]").click();
    await expect(page).toHaveURL(/\/fr\/compte\/tableau-de-bord/);

    await page.goto("/fr/compte/securite");
    await page.getByRole("button", { name: T.enable }).click();
    await expect(page.getByRole("img", { name: T.qrAlt })).toBeVisible(); // le code QR (SVG construit par React) s'affiche malgré la politique
    const secret = (await page.getByTestId("two-factor-secret").innerText()).replace(/\s/g, "");
    await page.locator("#two-factor-enable-code").fill(codeNow(secret));
    await page.getByRole("button", { name: T.confirm }).click();
    await expect(page.getByTestId("recovery-codes").locator("li")).toHaveCount(10);
    await page.getByLabel(T.recoverySaved).check();
    await page.getByRole("button", { name: T.done }).click();
    await expect(page.getByText(T.statusOn)).toBeVisible();

    // Déconnexion, puis connexion protégée par l'interface.
    await page.context().clearCookies();
    await page.goto("/fr/connexion");
    await page.locator("#login-email").fill(admin.email);
    await page.locator("#login-password").fill(PASSWORD);
    await page.locator("#login-email").locator("xpath=//ancestor::form").locator("button[type=submit]").click();
    await expect(page).toHaveURL(/\/fr\/connexion\/verification/);
    await page.locator("#two-factor-code").fill(codeNow(secret, 1));
    await page.getByRole("button", { name: T.verifyButton }).click();
    await expect(page).toHaveURL(/\/fr\/compte\/tableau-de-bord/);

    const violations = await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);
    expect(violations).toEqual([]);
    expect(problems).toEqual([]);
  });

  test("`npm run auth:reset-2fa` (accès au serveur) réinitialise un administrateur bloqué : ses pouvoirs disparaissent jusqu'à réactivation", async ({ page }) => {
    const admin = await createStaff("ADMIN");
    await apiLogin(page, admin.email);
    await enableViaApi(page);
    expect((await adminApi(page)).status()).toBe(404);

    const appRoot = path.resolve(__dirname, "..");
    const output = execFileSync(process.execPath, [path.join(appRoot, "node_modules", "tsx", "dist", "cli.mjs"), "scripts/reset-2fa.ts", "--email", admin.email], {
      cwd: appRoot,
      env: { ...process.env, DATABASE_URL: getE2eDatabaseUrl(), NODE_ENV: "production", REDIS_URL: "", SMTP_HOST: "" },
      encoding: "utf8",
    });
    expect(output).toContain("Double authentification réinitialisée");

    const row = await e2eDb().user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(row).toMatchObject({ totpEnabledAt: null, totpSecretEnc: null });
    expect(await e2eDb().twoFactorRecoveryCode.count({ where: { userId: admin.id } })).toBe(0);
    const log = await e2eDb().auditLog.findFirst({ where: { action: "two_factor.reset", targetId: admin.id } });
    expect(JSON.parse(log!.details!)).toEqual({ by: "commande" });
    expect((await adminApi(page)).status(), "la session est révoquée").toBe(403);

    // Il se reconnecte : plus de code, mais aussi plus de pouvoirs d'équipe, jusqu'à ce qu'il réactive la fonction.
    await apiLogin(page, admin.email);
    expect((await adminApi(page)).status()).toBe(403);
  });

  // Lot 145 — l'aperçu d'un brouillon suit le rôle EFFECTIF : sans double authentification, un administrateur n'a que les droits d'un
  // simple particulier, donc il ne voit pas un contenu non publié ; dès qu'il l'active, il le voit.
  test("un administrateur SANS double authentification ne voit pas l'aperçu d'un brouillon ; il le voit dès qu'il l'active", async ({ page }) => {
    const admin = await createStaff("ADMIN");
    const stamp = Date.now().toString(36);
    const article = await e2eDb().blogArticle.create({
      data: {
        slug: `pwa-apercu-${stamp}`,
        kind: "ARTICLE",
        titleFr: `Brouillon de l'aperçu en production ${stamp}`,
        titleAr: "مسودة المعاينة في الإنتاج للاختبار",
        excerptFr: "Brouillon de test de l'aperçu réservé aux administrateurs protégés.",
        excerptAr: "مسودة اختبار المعاينة الخاصة بالمشرفين المحميين بالتحقق الثنائي.",
        contentFr: "x".repeat(120),
        contentAr: "y".repeat(120),
        authorId: admin.id,
        publishedAt: null,
      },
      select: { id: true, slug: true },
    });
    try {
      await apiLogin(page, admin.email);
      const preview = () => page.request.get(`/fr/mag/${article.slug}`);
      expect((await preview()).status(), "sans double authentification : rôle effectif = particulier").toBe(404);
      await enableViaApi(page);
      const allowed = await preview();
      expect(allowed.status(), "avec double authentification : aperçu").toBe(200);
      expect(await allowed.text()).toContain("data-article-preview");
    } finally {
      await e2eDb().blogArticle.deleteMany({ where: { id: article.id } });
    }
  });

  // Lot 146 — le lien de relecture, sur la VERSION DE PRODUCTION : un relecteur SANS compte lit un brouillon sous la politique de sécurité
  // stricte (aucun script en ligne), sans la moindre violation ni erreur, avec les bons en-têtes ; un administrateur PROTÉGÉ par la double
  // authentification crée le lien, un autre visiteur n'obtient rien avec un jeton faux.
  test("un relecteur sans compte lit un brouillon par lien de relecture, sans violation de la politique de sécurité", async ({ page, browser }) => {
    const admin = await createStaff("ADMIN");
    const stamp = Date.now().toString(36);
    const article = await e2eDb().blogArticle.create({
      data: {
        slug: `pwa-relecture-${stamp}`,
        kind: "ARTICLE",
        titleFr: `Brouillon de relecture en production ${stamp}`,
        titleAr: "مسودة المراجعة في الإنتاج للاختبار",
        excerptFr: "Brouillon de test du lien de relecture, lu sans compte sur la version de production.",
        excerptAr: "مسودة اختبار رابط المراجعة، تُقرأ دون حساب على نسخة الإنتاج.",
        contentFr: "Contenu de test du lien de relecture. ".repeat(5),
        contentAr: "محتوى اختبار رابط المراجعة. ".repeat(5),
        authorId: admin.id,
        publishedAt: null,
      },
      select: { id: true, slug: true },
    });
    const reviewerContext = await browser.newContext();
    try {
      await apiLogin(page, admin.email);
      await enableViaApi(page);
      const created = await page.request.post(`/api/admin/blog/${article.id}/preview-links`, { data: { days: 1 } });
      expect(created.status(), await created.text()).toBe(201);
      const { paths } = await created.json();

      const problems: string[] = [];
      const reader = await reviewerContext.newPage();
      reader.on("console", (message: ConsoleMessage) => {
        if (message.type() === "error") problems.push(`console : ${message.text().slice(0, 200)}`);
      });
      reader.on("pageerror", (error) => problems.push(`exception : ${error.message}`));
      await reader.addInitScript(() => {
        (window as unknown as { __violations: string[] }).__violations = [];
        document.addEventListener("securitypolicyviolation", (event) => {
          (window as unknown as { __violations: string[] }).__violations.push(`${event.effectiveDirective} ${event.blockedURI || "inline"}`);
        });
      });

      for (const [locale, path] of [["fr", paths.fr], ["ar", paths.ar]] as const) {
        const response = await reader.goto(path);
        expect(response?.status(), locale).toBe(200);
        await expect(reader.locator("[data-article-preview]"), locale).toBeVisible();
        await expect(reader.getByRole("heading", { level: 1 }), locale).toBeVisible();
        // Hydratée sans la moindre violation de la politique de sécurité (aucun script en ligne, nonce respecté).
        expect(await reader.evaluate(() => (window as unknown as { __violations: string[] }).__violations), `${locale} : violations`).toEqual([]);
        expect(response?.headers()["content-security-policy"] ?? "", `${locale} : politique`).toMatch(/script-src[^;]*'nonce-/);
        expect(response?.headers()["cache-control"] ?? "", `${locale} : cache`).toMatch(/no-store|private|no-cache/);
      }
      expect(problems, "aucune erreur de console ni exception").toEqual([]);

      // Un jeton faux, ou l'absence de jeton : le même 404 qu'un contenu inexistant.
      expect((await reviewerContext.request.get(`/fr/mag/${article.slug}?apercu=${"A".repeat(43)}`)).status()).toBe(404);
      expect((await reviewerContext.request.get(`/fr/mag/${article.slug}`)).status()).toBe(404);
    } finally {
      await reviewerContext.close();
      await e2eDb().blogArticle.deleteMany({ where: { id: article.id } });
    }
  });
});
