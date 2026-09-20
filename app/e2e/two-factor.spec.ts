import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { uniqueAccount, registerAndLogin, giveOwnClientIp, type NewAccount } from "./fixtures";
import { disconnectE2eDb, e2eDb, makeAdmin, userIdOf } from "./db";
import { audit } from "./axe";
import { TOTP_STEP_SECONDS, totpCode } from "../src/lib/totp";
import fr from "../messages/fr.json";
import ar from "../messages/ar.json";

// Lot 138 — double authentification (TOTP), de bout en bout : le vrai site, la vraie base, un vrai navigateur, un vrai envoi SMTP
// vers un faux serveur. Les codes sont calculés ici avec le même algorithme que celui d'une application d'authentification
// (validé contre les vecteurs de la RFC 6238 dans tests/totp.test.ts).
//
// Un code d'application ne sert qu'UNE fois (anti-rejeu). Pour rejouer une connexion dans le même test sans attendre 30 secondes,
// on remet à zéro le dernier pas mémorisé en base (`forgetLastStep`) : c'est aussi ce qui permet de prouver, ailleurs, que sans cette
// remise à zéro le même code est bien refusé.
test.afterAll(disconnectE2eDb);
test.setTimeout(90_000);

const SMTP_INBOX = "http://localhost:5189";
const MOCK_GOOGLE = "http://localhost:5187";
const T = fr.TwoFactor;

const codeNow = (secret: string, offsetSteps = 0) => totpCode(secret.replace(/\s/g, ""), Date.now() + offsetSteps * TOTP_STEP_SECONDS * 1000);
const forgetLastStep = (email: string) => e2eDb().user.update({ where: { email }, data: { totpLastStep: null } });
const userRow = (email: string) => e2eDb().user.findUniqueOrThrow({ where: { email } });

async function inbox(request: APIRequestContext, email: string): Promise<{ subject: string; html: string }[]> {
  return (await request.get(`${SMTP_INBOX}/__mails?to=${encodeURIComponent(email)}`)).json();
}

// Active la fonction par l'API (pour les tests dont ce n'est pas le sujet). Le compte doit être connecté sur `page`.
async function enableViaApi(page: Page): Promise<{ secret: string; recoveryCodes: string[] }> {
  const setup = await (await page.request.post("/api/account/two-factor/setup")).json();
  const secret = String(setup.secret).replace(/\s/g, "");
  const enabled = await page.request.post("/api/account/two-factor/enable", { data: { code: codeNow(secret) } });
  expect(enabled.status()).toBe(200);
  return { secret, recoveryCodes: (await enabled.json()).recoveryCodes as string[] };
}

// Mot de passe correct, sans session : renvoie ce que dit la route (et laisse le cookie « en attente » dans le contexte).
async function passwordLogin(request: APIRequestContext, account: NewAccount, ip: string) {
  return request.post("/api/auth/login", { data: { email: account.email, password: account.password }, headers: { "x-forwarded-for": ip } });
}

const randomIp = () => `10.${1 + Math.floor(Math.random() * 253)}.${1 + Math.floor(Math.random() * 253)}.${1 + Math.floor(Math.random() * 253)}`;

async function uiLogin(page: Page, account: NewAccount) {
  await giveOwnClientIp(page);
  await page.goto("/fr/connexion");
  await page.locator("#login-email").fill(account.email);
  await page.locator("#login-password").fill(account.password);
  await page.locator("#login-email").locator("xpath=//ancestor::form").locator("button[type=submit]").click();
}

async function cookieNames(context: BrowserContext) {
  return (await context.cookies()).map((c) => c.name);
}

const me = async (page: Page) => (await page.request.get("/api/auth/me")).status();

test.describe("activation", () => {
  test("par l'interface : code QR et clé, confirmation par un code, dix codes de secours montrés UNE fois, puis « activée »", async ({ page, request }) => {
    const account = uniqueAccount("2fa-ui");
    await registerAndLogin(page, "fr", account);
    await page.goto("/fr/compte/securite");
    await expect(page.getByText(T.statusOff)).toBeVisible();

    await page.getByRole("button", { name: T.enable }).click();
    await expect(page.getByRole("img", { name: T.qrAlt })).toBeVisible();
    const secret = (await page.getByTestId("two-factor-secret").innerText()).replace(/\s/g, "");
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);

    await page.locator("#two-factor-enable-code").fill(codeNow(secret));
    await page.getByRole("button", { name: T.confirm }).click();

    await expect(page.getByRole("heading", { name: T.recoveryTitle })).toBeVisible();
    const shown = await page.getByTestId("recovery-codes").locator("li").allInnerTexts();
    expect(shown).toHaveLength(10);
    for (const code of shown) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    await expect(page.getByRole("button", { name: T.done })).toBeDisabled(); // tant qu'ils ne sont pas déclarés conservés
    await page.getByLabel(T.recoverySaved).check();
    await page.getByRole("button", { name: T.done }).click();
    await expect(page.getByText(T.statusOn)).toBeVisible();
    await expect(page.getByText(T.recoveryRemaining.replace("{count}", "10"))).toBeVisible();

    // Les codes ne sont plus JAMAIS affichés : recharger la page ne les montre pas.
    await page.reload();
    await expect(page.getByTestId("recovery-codes")).toHaveCount(0);

    // En base : secret chiffré (jamais en clair), dix empreintes (jamais les codes), sessions antérieures révoquées.
    const row = await userRow(account.email);
    expect(row.totpEnabledAt).not.toBeNull();
    expect(row.totpSecretEnc).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain(secret);
    const stored = await e2eDb().twoFactorRecoveryCode.findMany({ where: { userId: row.id } });
    expect(stored).toHaveLength(10);
    for (const code of shown) expect(JSON.stringify(stored)).not.toContain(code.replace(/-/g, ""));
    expect(row.sessionsValidAfter).not.toBeNull();
    expect(await me(page), "la session de la personne qui active la fonction reste valable").toBe(200);

    await expect.poll(async () => (await inbox(request, account.email)).some((m) => /activée/.test(m.subject))).toBe(true);
  });

  test("un mauvais code à l'activation est refusé et rien n'est activé", async ({ page }) => {
    const account = uniqueAccount("2fa-bad");
    await registerAndLogin(page, "fr", account);
    await page.goto("/fr/compte/securite");
    await page.getByRole("button", { name: T.enable }).click();
    await page.locator("#two-factor-enable-code").fill("000000");
    await page.getByRole("button", { name: T.confirm }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText(T.errorInvalidCode);
    expect((await userRow(account.email)).totpEnabledAt).toBeNull();
    expect(await e2eDb().twoFactorRecoveryCode.count({ where: { userId: (await userRow(account.email)).id } })).toBe(0);
  });

  test("en arabe (de droite à gauche) : la page et l'activation fonctionnent", async ({ page }) => {
    const account = uniqueAccount("2fa-ar");
    await registerAndLogin(page, "ar", account);
    await page.goto("/ar/compte/securite");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText(ar.TwoFactor.statusOff)).toBeVisible();
    await page.getByRole("button", { name: ar.TwoFactor.enable }).click();
    await expect(page.getByRole("img", { name: ar.TwoFactor.qrAlt })).toBeVisible();
    const secret = (await page.getByTestId("two-factor-secret").innerText()).replace(/\s/g, "");
    await page.locator("#two-factor-enable-code").fill(codeNow(secret));
    await page.getByRole("button", { name: ar.TwoFactor.confirm }).click();
    await expect(page.getByRole("heading", { name: ar.TwoFactor.recoveryTitle })).toBeVisible();
    // Les codes et la clé restent lisibles de gauche à droite dans une page de droite à gauche.
    await expect(page.getByTestId("recovery-codes")).toHaveAttribute("dir", "ltr");
  });

  test("accessibilité (axe) de chaque état de la page : départ, activation, codes de secours, activée — en français et en arabe", async ({ page }) => {
    const found: string[] = [];
    for (const locale of ["fr", "ar"] as const) {
      const account = uniqueAccount(`2fa-a11y-${locale}`);
      const t = locale === "fr" ? fr.TwoFactor : ar.TwoFactor;
      await registerAndLogin(page, locale, account);
      await page.goto(`/${locale}/compte/securite`);
      const check = async (state: string) => {
        for (const violation of await audit(page)) found.push(`${locale} ${state} : ${violation.id} — ${violation.nodes[0]?.html.slice(0, 90)}`);
      };
      await check("départ");
      await page.getByRole("button", { name: t.enable }).click();
      await expect(page.getByRole("img", { name: t.qrAlt })).toBeVisible();
      await check("activation");
      const secret = (await page.getByTestId("two-factor-secret").innerText()).replace(/\s/g, "");
      await page.locator("#two-factor-enable-code").fill(codeNow(secret));
      await page.getByRole("button", { name: t.confirm }).click();
      await expect(page.getByTestId("recovery-codes")).toBeVisible();
      await check("codes de secours");
      await page.getByLabel(t.recoverySaved).check();
      await page.getByRole("button", { name: t.done }).click();
      await expect(page.getByText(t.statusOn)).toBeVisible();
      await check("activée");
      await page.context().clearCookies();
    }
    expect(found).toEqual([]);
  });
});

test.describe("connexion", () => {
  test("après le mot de passe, AUCUNE session : la page du code s'affiche, et tout accès protégé reste refusé", async ({ page, browser }) => {
    const account = uniqueAccount("2fa-login");
    await registerAndLogin(page, "fr", account);
    await enableViaApi(page);

    const context = await browser.newContext();
    const other = await context.newPage();
    await uiLogin(other, account);
    await expect(other).toHaveURL(/\/fr\/connexion\/verification/);
    await expect(other.getByRole("heading", { name: T.verifyTitle })).toBeVisible();

    expect(await cookieNames(context), "cookie d'attente seulement").toContain("souq_auto_2fa");
    expect(await cookieNames(context), "aucun cookie de session").not.toContain("souq_auto_session");
    expect(await me(other)).toBe(401);
    await other.goto("/fr/compte/tableau-de-bord");
    await expect(other).toHaveURL(/\/fr\/connexion/);
    expect((await other.request.get("/api/profile/export")).status()).toBe(401);
    await context.close();
  });

  test("un code faux est refusé ; le bon ouvre la session et mène au tableau de bord", async ({ page, browser }) => {
    const account = uniqueAccount("2fa-ok");
    await registerAndLogin(page, "fr", account);
    const { secret } = await enableViaApi(page);

    const context = await browser.newContext();
    const other = await context.newPage();
    await uiLogin(other, account);
    await expect(other).toHaveURL(/\/connexion\/verification/);
    await other.locator("#two-factor-code").fill("000000");
    await other.getByRole("button", { name: T.verifyButton }).click();
    await expect(other.locator('p[role="alert"]')).toHaveText(T.errorInvalidCode);
    expect(await me(other)).toBe(401);

    await other.locator("#two-factor-code").fill(codeNow(secret, 1)); // le pas suivant : le pas courant a servi à l'activation
    await other.getByRole("button", { name: T.verifyButton }).click();
    await expect(other).toHaveURL(/\/fr\/compte\/tableau-de-bord/);
    expect(await me(other)).toBe(200);
    expect(await cookieNames(context)).not.toContain("souq_auto_2fa"); // le cookie d'attente est retiré
    // Un succès remet le compteur d'échecs à zéro.
    expect((await userRow(account.email)).failedLoginAttempts).toBe(0);
    await context.close();
  });

  test("un code DÉJÀ UTILISÉ est refusé (pas de rejeu), même s'il est encore dans sa minute de validité", async ({ page, browser }) => {
    const account = uniqueAccount("2fa-replay");
    await registerAndLogin(page, "fr", account);
    const { secret } = await enableViaApi(page);
    const code = codeNow(secret, 1);

    const first = await browser.newContext();
    expect((await passwordLogin(first.request, account, randomIp())).status()).toBe(200);
    expect((await first.request.post("/api/auth/two-factor/verify", { data: { code } })).status()).toBe(200);

    const second = await browser.newContext();
    expect((await passwordLogin(second.request, account, randomIp())).status()).toBe(200);
    const replay = await second.request.post("/api/auth/two-factor/verify", { data: { code } });
    expect(replay.status()).toBe(401);
    expect((await replay.json()).error).toBe("invalid_code");
    expect((await second.request.get("/api/auth/me")).status()).toBe(401);
    await first.close();
    await second.close();
  });

  test("deux vérifications SIMULTANÉES avec le même code : une seule ouvre une session", async ({ page, browser }) => {
    const account = uniqueAccount("2fa-race");
    await registerAndLogin(page, "fr", account);
    const { secret } = await enableViaApi(page);
    const code = codeNow(secret, 1);

    const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
    for (const context of contexts) expect((await passwordLogin(context.request, account, randomIp())).status()).toBe(200);
    const results = await Promise.all(contexts.map((context) => context.request.post("/api/auth/two-factor/verify", { data: { code } })));
    expect(results.filter((r) => r.status() === 200), "un seul succès").toHaveLength(1);
    for (const context of contexts) await context.close();
  });

  test("un code de secours ouvre la session UNE fois, prévient la personne par courriel, et il en reste neuf", async ({ page, browser, request }) => {
    const account = uniqueAccount("2fa-recovery");
    await registerAndLogin(page, "fr", account);
    const { recoveryCodes } = await enableViaApi(page);

    const first = await browser.newContext();
    await passwordLogin(first.request, account, randomIp());
    const ok = await first.request.post("/api/auth/two-factor/verify", { data: { code: recoveryCodes[0].toLowerCase() } }); // minuscules : toléré
    expect(ok.status()).toBe(200);
    expect((await ok.json()).method).toBe("recovery");

    const second = await browser.newContext();
    await passwordLogin(second.request, account, randomIp());
    expect((await second.request.post("/api/auth/two-factor/verify", { data: { code: recoveryCodes[0] } })).status(), "le même code une deuxième fois").toBe(401);
    expect((await second.request.post("/api/auth/two-factor/verify", { data: { code: recoveryCodes[1] } })).status(), "un autre code de secours").toBe(200);

    expect(await e2eDb().twoFactorRecoveryCode.count({ where: { userId: (await userRow(account.email)).id, usedAt: null } })).toBe(8);
    await expect.poll(async () => (await inbox(request, account.email)).filter((m) => /code de secours/i.test(m.subject)).length).toBeGreaterThanOrEqual(2);
    await first.close();
    await second.close();
  });

  test("cinq codes faux verrouillent le compte : même le bon code est refusé ensuite (423), et le mot de passe seul ne remet rien à zéro", async ({ page, browser }) => {
    const account = uniqueAccount("2fa-lock");
    await registerAndLogin(page, "fr", account);
    const { secret } = await enableViaApi(page);

    const attacker = await browser.newContext();
    const ip = randomIp();
    for (let attempt = 1; attempt <= 5; attempt++) {
      // À chaque tentative l'attaquant re-saisit le BON mot de passe : cela ne doit pas effacer le compte des échecs.
      expect((await passwordLogin(attacker.request, account, ip)).status(), `mot de passe, essai ${attempt}`).toBe(200);
      const wrong = await attacker.request.post("/api/auth/two-factor/verify", { data: { code: "000000" } });
      expect(wrong.status(), `code faux ${attempt}`).toBe(401);
    }
    expect((await userRow(account.email)).failedLoginAttempts).toBe(5);
    expect((await userRow(account.email)).lockedUntil).not.toBeNull();

    // Verrouillé : le mot de passe seul est refusé (423), et le bon code ne suffit plus.
    expect((await passwordLogin(attacker.request, account, ip)).status()).toBe(423);
    const legit = await browser.newContext();
    await legit.request.post("/api/auth/login", { data: { email: account.email, password: account.password }, headers: { "x-forwarded-for": randomIp() } });
    const verify = await legit.request.post("/api/auth/two-factor/verify", { data: { code: codeNow(secret, 1) } });
    expect([401, 423]).toContain(verify.status()); // pas de cookie d'attente (mot de passe refusé) ou compte verrouillé : dans les deux cas, aucune session
    expect((await legit.request.get("/api/auth/me")).status()).toBe(401);
    await attacker.close();
    await legit.close();
  });

  test("le jeton d'attente n'est PAS une session : le recopier dans le cookie de session n'ouvre rien", async ({ page, browser }) => {
    const account = uniqueAccount("2fa-forge");
    await registerAndLogin(page, "fr", account);
    await enableViaApi(page);

    const context = await browser.newContext();
    await passwordLogin(context.request, account, randomIp());
    const pending = (await context.cookies()).find((c) => c.name === "souq_auto_2fa")!;
    expect(pending.httpOnly).toBe(true);
    await context.addCookies([{ name: "souq_auto_session", value: pending.value, domain: pending.domain, path: "/" }]);
    expect((await context.request.get("/api/auth/me")).status()).toBe(401);
    const other = await context.newPage();
    await other.goto("/fr/compte/tableau-de-bord");
    await expect(other).toHaveURL(/\/fr\/connexion/);
    await context.close();
  });

  test("sans connexion en attente, la page du code renvoie à la connexion ; la vérification refuse", async ({ page, request }) => {
    await page.goto("/fr/connexion/verification");
    await expect(page).toHaveURL(/\/fr\/connexion$/);
    const response = await request.post("/api/auth/two-factor/verify", { data: { code: "123456" }, headers: { "x-forwarded-for": randomIp() } });
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toBe("no_pending");
  });

  test("Google : un compte protégé passe aussi par le code — aucune session avant", async ({ page, browser, request }) => {
    const account = uniqueAccount("2fa-google");
    await registerAndLogin(page, "fr", account);
    await e2eDb().user.update({ where: { email: account.email }, data: { emailVerifiedAt: new Date() } }); // Google rattache une adresse VÉRIFIÉE
    const { secret } = await enableViaApi(page);

    expect((await request.post(`${MOCK_GOOGLE}/__control`, { data: { reset: true, identity: { sub: `sub-${Date.now()}`, email: account.email, email_verified: true, name: "Amina" } } })).status()).toBe(204);
    const context = await browser.newContext();
    const other = await context.newPage();
    await giveOwnClientIp(other);
    await other.goto("/fr/connexion");
    await other.getByRole("link", { name: fr.Auth.googleContinue }).click();
    await expect(other).toHaveURL(/\/fr\/connexion\/verification/);
    expect(await me(other), "Google a prouvé l'identité, pas le second facteur").toBe(401);
    expect(await cookieNames(context)).not.toContain("souq_auto_session");

    await other.locator("#two-factor-code").fill(codeNow(secret, 1));
    await other.getByRole("button", { name: T.verifyButton }).click();
    await expect(other).toHaveURL(/\/fr\/compte\/tableau-de-bord/);
    expect(await me(other)).toBe(200);
    await context.close();
  });

  test("la page du code, en français et en arabe, respecte l'accessibilité (axe)", async ({ page, browser }) => {
    const account = uniqueAccount("2fa-verify-a11y");
    await registerAndLogin(page, "fr", account);
    await enableViaApi(page);
    const context = await browser.newContext();
    await passwordLogin(context.request, account, randomIp());
    const other = await context.newPage();
    for (const locale of ["fr", "ar"] as const) {
      await other.goto(`/${locale}/connexion/verification`);
      await expect(other.getByRole("heading", { name: (locale === "fr" ? fr : ar).TwoFactor.verifyTitle })).toBeVisible();
      expect((await audit(other)).map((v) => `${locale} ${v.id}`)).toEqual([]);
      await other.getByRole("button", { name: (locale === "fr" ? fr : ar).TwoFactor.useRecovery }).click();
      expect((await audit(other)).map((v) => `${locale} recours ${v.id}`)).toEqual([]);
    }
    await context.close();
  });
});

test.describe("gestion du compte", () => {
  test("de nouveaux codes de secours exigent un code, et les anciens cessent de fonctionner", async ({ page, browser }) => {
    const account = uniqueAccount("2fa-regen");
    await registerAndLogin(page, "fr", account);
    const { secret, recoveryCodes } = await enableViaApi(page);

    expect((await page.request.post("/api/account/two-factor/recovery-codes", { data: { code: "000000" } })).status()).toBe(400);
    const regenerated = await page.request.post("/api/account/two-factor/recovery-codes", { data: { code: codeNow(secret, 1) } });
    expect(regenerated.status()).toBe(200);
    const fresh = (await regenerated.json()).recoveryCodes as string[];
    expect(fresh).toHaveLength(10);
    expect(fresh.some((c) => recoveryCodes.includes(c))).toBe(false);

    const context = await browser.newContext();
    await passwordLogin(context.request, account, randomIp());
    expect((await context.request.post("/api/auth/two-factor/verify", { data: { code: recoveryCodes[0] } })).status(), "ancien code").toBe(401);
    expect((await context.request.post("/api/auth/two-factor/verify", { data: { code: fresh[0] } })).status(), "nouveau code").toBe(200);
    await context.close();
  });

  test("désactiver exige le mot de passe ET un code ; ensuite la connexion ne demande plus de code", async ({ page, browser }) => {
    const account = uniqueAccount("2fa-off");
    await registerAndLogin(page, "fr", account);
    const { secret } = await enableViaApi(page);
    await forgetLastStep(account.email);

    const noPassword = await page.request.post("/api/account/two-factor/disable", { data: { code: codeNow(secret) } });
    expect(noPassword.status()).toBe(400);
    expect((await noPassword.json()).error).toBe("invalid_password");
    expect((await page.request.post("/api/account/two-factor/disable", { data: { password: "mauvais", code: codeNow(secret) } })).status()).toBe(400);
    expect((await page.request.post("/api/account/two-factor/disable", { data: { password: account.password, code: "000000" } })).status()).toBe(400);
    expect((await userRow(account.email)).totpEnabledAt, "les refus n'ont rien désactivé").not.toBeNull();

    expect((await page.request.post("/api/account/two-factor/disable", { data: { password: account.password, code: codeNow(secret) } })).status()).toBe(200);
    const row = await userRow(account.email);
    expect(row).toMatchObject({ totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null });
    expect(await e2eDb().twoFactorRecoveryCode.count({ where: { userId: row.id } })).toBe(0);

    const context = await browser.newContext();
    const login = await passwordLogin(context.request, account, randomIp());
    expect((await login.json()).twoFactorRequired).toBeUndefined();
    expect((await context.request.get("/api/auth/me")).status(), "session directe, sans code").toBe(200);
    await context.close();
  });

  test("par l'interface : désactivation avec mot de passe et code, puis l'état repasse à « désactivée »", async ({ page }) => {
    const account = uniqueAccount("2fa-off-ui");
    await registerAndLogin(page, "fr", account);
    const { secret } = await enableViaApi(page);
    await forgetLastStep(account.email);
    await page.goto("/fr/compte/securite");
    await expect(page.getByText(T.statusOn)).toBeVisible();
    await page.locator("#two-factor-disable-password").fill(account.password);
    await page.locator("#two-factor-disable-code").fill(codeNow(secret));
    await page.getByRole("button", { name: T.disable }).click();
    await expect(page.getByText(T.statusOff)).toBeVisible();
  });

  test("les routes de gestion exigent une session, et refusent un compte déjà protégé pour une nouvelle activation", async ({ page, request }) => {
    for (const path of ["setup", "enable", "disable", "recovery-codes"]) {
      expect((await request.post(`/api/account/two-factor/${path}`, { data: {} })).status(), path).toBe(401);
    }
    const account = uniqueAccount("2fa-twice");
    await registerAndLogin(page, "fr", account);
    await enableViaApi(page);
    expect((await page.request.post("/api/account/two-factor/setup")).status()).toBe(409);
  });
});

test.describe("administration", () => {
  test("un administrateur réinitialise la double authentification : session révoquée, connexion sans code, courriel, journal d'audit", async ({ browser, page, request }) => {
    const target = uniqueAccount("2fa-target");
    const victimContext = await browser.newContext();
    const victim = await victimContext.newPage();
    await registerAndLogin(victim, "fr", target);
    await enableViaApi(victim);
    expect(await me(victim)).toBe(200);

    const admin = uniqueAccount("2fa-admin");
    await registerAndLogin(page, "fr", admin);
    await makeAdmin(admin.email);
    const targetId = await userIdOf(target.email);

    expect((await page.request.post(`/api/admin/users/${targetId}/two-factor/reset`)).status()).toBe(200);
    expect(await me(victim), "la session ouverte de la personne est révoquée").toBe(401);
    expect((await userRow(target.email)).totpEnabledAt).toBeNull();

    const context = await browser.newContext();
    expect((await (await passwordLogin(context.request, target, randomIp())).json()).twoFactorRequired).toBeUndefined();
    await context.close();

    await expect.poll(async () => (await inbox(request, target.email)).some((m) => /réinitialisée/i.test(m.subject))).toBe(true);
    const log = await e2eDb().auditLog.findFirst({ where: { action: "two_factor.reset", targetId }, orderBy: { createdAt: "desc" } });
    expect(log?.adminId).toBe(await userIdOf(admin.email));
    expect((await page.request.post(`/api/admin/users/${targetId}/two-factor/reset`)).status(), "déjà réinitialisé").toBe(409);
    await victimContext.close();
  });

  test("un modérateur ne peut pas, un administrateur ne peut pas le faire sur lui-même, un inconnu est refusé", async ({ page, browser }) => {
    const admin = uniqueAccount("2fa-admin2");
    await registerAndLogin(page, "fr", admin);
    await makeAdmin(admin.email);
    const { secret } = await enableViaApi(page);
    expect(secret).toBeTruthy();
    expect((await page.request.post(`/api/admin/users/${await userIdOf(admin.email)}/two-factor/reset`)).status(), "sur soi-même").toBe(400);
    expect((await page.request.post("/api/admin/users/inexistant/two-factor/reset")).status()).toBe(404);

    const moderator = uniqueAccount("2fa-moderator");
    const context = await browser.newContext();
    const modPage = await context.newPage();
    await registerAndLogin(modPage, "fr", moderator);
    await e2eDb().user.update({ where: { email: moderator.email }, data: { role: "MODERATEUR" } });
    expect((await modPage.request.post(`/api/admin/users/${await userIdOf(admin.email)}/two-factor/reset`)).status()).toBe(403);
    await context.close();

    const anonymous = await browser.newContext();
    expect((await anonymous.request.post(`/api/admin/users/${await userIdOf(admin.email)}/two-factor/reset`)).status()).toBe(403);
    await anonymous.close();
  });

  test("la liste des utilisateurs montre qui est protégé, et le bouton de réinitialisation fonctionne", async ({ page, browser }) => {
    const target = uniqueAccount("2fa-list");
    const victimContext = await browser.newContext();
    const victim = await victimContext.newPage();
    await registerAndLogin(victim, "fr", target);
    await enableViaApi(victim);

    const admin = uniqueAccount("2fa-admin3");
    await registerAndLogin(page, "fr", admin);
    await makeAdmin(admin.email);
    await page.goto("/fr/admin/utilisateurs");
    const row = page.locator("div.flex.items-center.justify-between").filter({ hasText: target.email });
    await expect(row.getByText(`${T.adminColumn} : ${T.adminEnabled}`)).toBeVisible();
    page.once("dialog", (dialog) => void dialog.accept());
    await row.getByRole("button", { name: T.adminReset }).click();
    await expect(row.getByText(`${T.adminColumn} : ${T.adminEnabled}`)).toHaveCount(0);
    expect((await userRow(target.email)).totpEnabledAt).toBeNull();
    await victimContext.close();
  });
});
