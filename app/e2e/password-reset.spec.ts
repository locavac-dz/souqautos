import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { uniqueAccount, registerAndLogin, giveOwnClientIp } from "./fixtures";
import { disconnectE2eDb, e2eDb } from "./db";
import fr from "../messages/fr.json";
import ar from "../messages/ar.json";

// Lot 133 — « mot de passe oublié », de bout en bout : le vrai site, la vraie base, la vraie bibliothèque d'envoi de
// courriels ; seuls le serveur SMTP (e2e/mock-smtp.mjs, qui garde les messages pour les tests) et Google
// (e2e/mock-google.mjs) sont simulés. Les liens sont lus DANS les courriels reçus, comme le ferait une personne.
test.afterAll(disconnectE2eDb);

const MAILBOX = "http://localhost:5189";
const MOCK_GOOGLE = "http://localhost:5187";
const NEW_PASSWORD = "NouveauMotDePasse2026!";

type Mail = { to: string; subject: string; html: string; links: string[] };

// Attend qu'au moins `count` courriels soient arrivés pour cette adresse (l'envoi se fait après la réponse de la route).
async function mailsFor(request: APIRequestContext, to: string, count = 1): Promise<Mail[]> {
  let mails: Mail[] = [];
  await expect
    .poll(
      async () => {
        mails = await (await request.get(`${MAILBOX}/__mails?to=${encodeURIComponent(to)}`)).json();
        return mails.length;
      },
      { timeout: 20_000, message: `courriel pour ${to}` }
    )
    .toBeGreaterThanOrEqual(count);
  return mails;
}

async function expectNoMail(request: APIRequestContext, to: string) {
  await new Promise((resolve) => setTimeout(resolve, 2000)); // le temps qu'un envoi éventuel se produise
  expect(await (await request.get(`${MAILBOX}/__mails?to=${encodeURIComponent(to)}`)).json()).toEqual([]);
}

const resetLink = (mail: Mail) => mail.links.find((link) => link.includes("/reinitialiser-mot-de-passe/"))!;
const tokenOf = (link: string) => link.split("/").pop()!;
const requestReset = (page: Page, email: string) => page.request.post("/api/auth/password-reset/request", { data: { email } });

async function newAccountLoggedOut(page: Page, prefix: string, locale: "fr" | "ar" = "fr") {
  const account = uniqueAccount(prefix);
  await registerAndLogin(page, locale, account);
  await page.request.post("/api/auth/logout");
  return account;
}

test.beforeEach(async ({ page }) => {
  await giveOwnClientIp(page); // limites par adresse IP : une adresse par test
});

test.describe("parcours complet", () => {
  test("demande, courriel, nouveau mot de passe, ancien mot de passe refusé, jeton consommé, courriel de confirmation", async ({ page, request }) => {
    const account = await newAccountLoggedOut(page, "oubli");

    // 1. La demande, depuis la page.
    await page.goto("/fr/connexion");
    await page.getByRole("link", { name: fr.Auth.forgotPasswordLink }).click();
    await expect(page).toHaveURL(/\/fr\/mot-de-passe-oublie/);
    await page.locator("#forgot-email").fill(account.email);
    await page.getByRole("button", { name: fr.PasswordReset.submitRequest }).click();
    await expect(page.locator('p[role="status"]')).toHaveText(fr.PasswordReset.sent);

    // 2. Le courriel : bon objet, bon lien, en français.
    const [mail] = await mailsFor(request, account.email);
    expect(mail.subject).toBe("Réinitialisation de votre mot de passe — Souq Auto");
    const link = resetLink(mail);
    expect(link).toMatch(/^http:\/\/localhost:5185\/fr\/reinitialiser-mot-de-passe\/[A-Za-z0-9_-]{43}$/);
    expect(mail.html).toContain("1 heure");
    const token = tokenOf(link);

    // 3. La base ne contient JAMAIS le jeton lui-même, seulement son empreinte ; valable une heure.
    const rows = await e2eDb().passwordResetToken.findMany({ where: { user: { email: account.email } } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows)).not.toContain(token);
    const minutes = (rows[0].expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(55);
    expect(minutes).toBeLessThanOrEqual(60.5);

    // 4. La page du lien : deux mots de passe différents sont refusés, puis le bon est enregistré.
    await page.goto(link);
    await expect(page.getByRole("heading", { level: 1, name: fr.PasswordReset.resetTitle })).toBeVisible();
    await page.locator("#reset-password").fill(NEW_PASSWORD);
    await page.locator("#reset-password-confirm").fill(`${NEW_PASSWORD}x`);
    await page.getByRole("button", { name: fr.PasswordReset.submitReset }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText(fr.PasswordReset.errorMismatch);

    await page.locator("#reset-password-confirm").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: fr.PasswordReset.submitReset }).click();
    await expect(page).toHaveURL(/\/fr\/connexion\?reinitialise=1/);
    await expect(page.locator('p[role="status"]')).toHaveText(fr.Auth.passwordResetDone);
    expect((await page.request.get("/api/auth/me")).status(), "aucune session n'est ouverte automatiquement").toBe(401);

    // 5. Ancien mot de passe refusé, nouveau accepté.
    const before = await page.request.post("/api/auth/login", { data: { email: account.email, password: account.password } });
    expect(before.status()).toBe(401);
    const after = await page.request.post("/api/auth/login", { data: { email: account.email, password: NEW_PASSWORD } });
    expect(after.status()).toBe(200);

    // 6. La personne est prévenue du changement ; l'adresse est désormais vérifiée (elle a lu ce courrier).
    const mails = await mailsFor(request, account.email, 2);
    expect(mails.map((m) => m.subject)).toContain("Votre mot de passe a été modifié — Souq Auto");
    expect((await e2eDb().user.findUniqueOrThrow({ where: { email: account.email } })).emailVerifiedAt).not.toBeNull();

    // 7. Le lien est à usage unique.
    await page.goto(link);
    await expect(page.getByRole("heading", { level: 1, name: fr.PasswordReset.invalidLinkTitle })).toBeVisible();
    const replay = await page.request.post("/api/auth/password-reset/confirm", { data: { token, password: "UnAutreMotDePasse2026!" } });
    expect(replay.status()).toBe(400);
    expect(await replay.json()).toEqual({ error: "invalid_token" });
    expect(await e2eDb().passwordResetToken.count({ where: { user: { email: account.email } } })).toBe(0);
    expect((await page.request.post("/api/auth/login", { data: { email: account.email, password: "UnAutreMotDePasse2026!" } })).status()).toBe(401);
  });

  test("un nouveau lien remplace le précédent, qui cesse de fonctionner", async ({ page, request }) => {
    const account = await newAccountLoggedOut(page, "deux-liens");
    await requestReset(page, account.email);
    const [first] = await mailsFor(request, account.email);
    await requestReset(page, account.email);
    const mails = await mailsFor(request, account.email, 2);
    const oldLink = resetLink(first);
    const newLink = resetLink(mails[1]);
    expect(newLink).not.toBe(oldLink);
    expect(await e2eDb().passwordResetToken.count({ where: { user: { email: account.email } } })).toBe(1);

    expect((await page.request.post("/api/auth/password-reset/confirm", { data: { token: tokenOf(oldLink), password: NEW_PASSWORD } })).status()).toBe(400);
    expect((await page.request.post("/api/auth/password-reset/confirm", { data: { token: tokenOf(newLink), password: NEW_PASSWORD } })).status()).toBe(200);
  });

  test("le déverrouillage après échecs de connexion est inclus, et les pages sont en arabe pour un compte arabe", async ({ page, request }) => {
    const account = await newAccountLoggedOut(page, "arabe", "ar");
    await e2eDb().user.update({ where: { email: account.email }, data: { locale: "ar", failedLoginAttempts: 6, lockedUntil: new Date(Date.now() + 3_600_000) } });
    expect((await page.request.post("/api/auth/login", { data: { email: account.email, password: account.password } })).status()).toBe(423);

    await page.goto("/ar/mot-de-passe-oublie");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.locator("#forgot-email").fill(account.email);
    await page.getByRole("button", { name: ar.PasswordReset.submitRequest }).click();
    await expect(page.locator('p[role="status"]')).toHaveText(ar.PasswordReset.sent);

    const [mail] = await mailsFor(request, account.email);
    expect(mail.subject).toBe("إعادة تعيين كلمة المرور — سوق أوتو");
    expect(mail.html).toContain('dir="rtl"');
    const link = resetLink(mail);
    expect(link).toContain("/ar/reinitialiser-mot-de-passe/");

    await page.goto(link);
    await expect(page.getByRole("heading", { level: 1, name: ar.PasswordReset.resetTitle })).toBeVisible();
    await page.locator("#reset-password").fill(NEW_PASSWORD);
    await page.locator("#reset-password-confirm").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: ar.PasswordReset.submitReset }).click();
    await expect(page).toHaveURL(/\/ar\/connexion\?reinitialise=1/);
    await expect(page.locator('p[role="status"]')).toHaveText(ar.Auth.passwordResetDone);

    const user = await e2eDb().user.findUniqueOrThrow({ where: { email: account.email } });
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect((await page.request.post("/api/auth/login", { data: { email: account.email, password: NEW_PASSWORD } })).status()).toBe(200);
    expect((await mailsFor(request, account.email, 2))[1].subject).toBe("تم تغيير كلمة المرور — سوق أوتو");
  });
});

test.describe("ce que la demande ne révèle pas, et ses limites", () => {
  test("la réponse est identique pour un compte qui existe et un compte qui n'existe pas ; seul le premier reçoit un courriel", async ({ page, request }) => {
    const known = await newAccountLoggedOut(page, "connu");
    const unknownEmail = `inconnu-${Date.now()}@example.dz`;

    const a = await requestReset(page, known.email);
    const b = await requestReset(page, unknownEmail);
    expect([a.status(), b.status()]).toEqual([200, 200]);
    expect(await a.json()).toEqual(await b.json());
    expect(a.headers()["cache-control"]).toBe(b.headers()["cache-control"]);
    expect(a.headers()["content-type"]).toBe(b.headers()["content-type"]);

    await mailsFor(request, known.email);
    await expectNoMail(request, unknownEmail);

    // Même message à l'écran.
    await page.goto("/fr/mot-de-passe-oublie");
    await page.locator("#forgot-email").fill(`autre-inconnu-${Date.now()}@example.dz`);
    await page.getByRole("button", { name: fr.PasswordReset.submitRequest }).click();
    await expect(page.locator('p[role="status"]')).toHaveText(fr.PasswordReset.sent);
  });

  test("un compte suspendu ou supprimé ne reçoit pas de courriel, sans que la réponse le trahisse", async ({ page, request }) => {
    const suspended = await newAccountLoggedOut(page, "suspendu");
    await e2eDb().user.update({ where: { email: suspended.email }, data: { suspendedAt: new Date() } });
    const deleted = await newAccountLoggedOut(page, "supprime");
    await e2eDb().user.update({ where: { email: deleted.email }, data: { deletedAt: new Date() } });

    for (const email of [suspended.email, deleted.email]) {
      const r = await requestReset(page, email);
      expect(r.status(), email).toBe(200);
      expect(await r.json()).toEqual({ ok: true });
      await expectNoMail(request, email);
    }
    expect(await e2eDb().passwordResetToken.count({ where: { user: { email: { in: [suspended.email, deleted.email] } } } })).toBe(0);
  });

  test("les demandes sont limitées par adresse e-mail (3 par heure) et par adresse IP (5 par quart d'heure), que le compte existe ou non", async ({ page }) => {
    const email = `limite-${Date.now()}@example.dz`; // n'existe pas : la limite ne doit pas le trahir
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await requestReset(page, email)).status());
    expect(statuses).toEqual([200, 200, 200, 429]);

    // Cinq demandes depuis la même adresse IP (dont les 3 ci-dessus) : la sixième est refusée, même pour une autre adresse e-mail.
    expect((await requestReset(page, `autre1-${Date.now()}@example.dz`)).status()).toBe(200);
    expect((await requestReset(page, `autre2-${Date.now()}@example.dz`)).status()).toBe(429);

    // Un autre visiteur (autre adresse IP) n'est pas touché.
    await giveOwnClientIp(page);
    expect((await requestReset(page, `autre3-${Date.now()}@example.dz`)).status()).toBe(200);
  });

  test("une adresse mal formée est refusée, sans erreur serveur", async ({ page }) => {
    for (const email of ["", "pas-une-adresse", "a@", "x".repeat(300) + "@example.dz"]) {
      expect((await requestReset(page, email)).status(), email).toBe(400);
    }
    expect((await page.request.post("/api/auth/password-reset/request", { data: "pas du json", headers: { "content-type": "application/json" } })).status()).toBe(400);
    // Les demandes refusées comptent aussi dans la limite par adresse IP (5 par quart d'heure) : autre visiteur pour la suite.
    await giveOwnClientIp(page);
    expect((await page.request.post("/api/auth/password-reset/request", { data: {} })).status()).toBe(400);
  });
});

test.describe("jetons invalides, expirés, falsifiés", () => {
  test("un lien mal formé, inconnu ou piégé affiche « lien invalide », jamais une erreur", async ({ page }) => {
    const attempts = ["abc", "a".repeat(43), "a".repeat(200), "%27%20OR%201%3D1--", "..%2F..%2Fetc%2Fpasswd", "scriptalert1script"];
    for (const token of attempts) {
      const response = await page.goto(`/fr/reinitialiser-mot-de-passe/${token}`);
      expect(response?.status(), token).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: fr.PasswordReset.invalidLinkTitle }), token).toBeVisible();
      await expect(page.locator("#reset-password")).toHaveCount(0);
      const api = await page.request.post("/api/auth/password-reset/confirm", { data: { token: decodeURIComponent(token), password: NEW_PASSWORD } });
      expect(api.status(), token).toBe(400);
    }
  });

  test("un lien expiré (plus d'une heure) est refusé, page et API", async ({ page, request }) => {
    const account = await newAccountLoggedOut(page, "expire");
    await requestReset(page, account.email);
    const link = resetLink((await mailsFor(request, account.email))[0]);
    await e2eDb().passwordResetToken.updateMany({ where: { user: { email: account.email } }, data: { expiresAt: new Date(Date.now() - 1000) } });

    await page.goto(link);
    await expect(page.getByRole("heading", { level: 1, name: fr.PasswordReset.invalidLinkTitle })).toBeVisible();
    const api = await page.request.post("/api/auth/password-reset/confirm", { data: { token: tokenOf(link), password: NEW_PASSWORD } });
    expect(api.status()).toBe(400);
    expect((await page.request.post("/api/auth/login", { data: { email: account.email, password: account.password } })).status(), "le mot de passe n'a pas changé").toBe(200);
  });

  test("un mot de passe trop court est refusé et le jeton reste utilisable ; deux demandes simultanées ne changent le mot de passe qu'une fois", async ({ page, request }) => {
    const account = await newAccountLoggedOut(page, "simultane");
    await requestReset(page, account.email);
    const token = tokenOf(resetLink((await mailsFor(request, account.email))[0]));

    for (const password of ["", "court", "x".repeat(201)]) {
      expect((await page.request.post("/api/auth/password-reset/confirm", { data: { token, password } })).status(), password).toBe(400);
    }
    expect(await e2eDb().passwordResetToken.count({ where: { user: { email: account.email } } })).toBe(1);

    const results = await Promise.all(["PremierMotDePasse2026!", "SecondMotDePasse2026!"].map((password) => page.request.post("/api/auth/password-reset/confirm", { data: { token, password } })));
    expect(results.map((r) => r.status()).sort()).toEqual([200, 400]); // une seule demande aboutit
    const winner = results[0].status() === 200 ? "PremierMotDePasse2026!" : "SecondMotDePasse2026!";
    expect((await page.request.post("/api/auth/login", { data: { email: account.email, password: winner } })).status()).toBe(200);
  });
});

test.describe("sécurité des sessions et des comptes", () => {
  test("toutes les sessions ouvertes avant la réinitialisation sont révoquées ; une nouvelle connexion fonctionne", async ({ page, browser, request }) => {
    const account = uniqueAccount("sessions");
    await registerAndLogin(page, "fr", account); // session de la personne (ou de l'usurpateur qui a pris le compte)
    expect((await page.request.get("/api/auth/me")).status()).toBe(200);

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await giveOwnClientIp(otherPage);
    await requestReset(otherPage, account.email);
    const token = tokenOf(resetLink((await mailsFor(request, account.email))[0]));
    expect((await otherPage.request.post("/api/auth/password-reset/confirm", { data: { token, password: NEW_PASSWORD } })).status()).toBe(200);

    expect((await page.request.get("/api/auth/me")).status(), "l'ancienne session est révoquée").toBe(401);
    await page.goto("/fr/compte/tableau-de-bord");
    await expect(page).toHaveURL(/\/fr\/connexion/);

    expect((await otherPage.request.post("/api/auth/login", { data: { email: account.email, password: NEW_PASSWORD } })).status()).toBe(200);
    expect((await otherPage.request.get("/api/auth/me")).status(), "une session ouverte APRÈS le changement fonctionne").toBe(200);
    await other.close();
  });

  test("récupérer un compte usurpé : réinitialiser le mot de passe vérifie l'adresse, puis Google peut être rattaché", async ({ page, request }) => {
    // Quelqu'un s'est inscrit avec cette adresse (non vérifiée). Google refuse de s'y rattacher (Lot 132)…
    const account = await newAccountLoggedOut(page, "recup");
    const google = { sub: `sub-recup-${Date.now()}`, email: account.email, email_verified: true, name: "La vraie personne" };
    await request.post(`${MOCK_GOOGLE}/__control`, { data: { reset: true, identity: google } });
    await page.goto("/fr/connexion");
    await page.getByRole("link", { name: fr.Auth.googleContinue }).click();
    await expect(page).toHaveURL(/erreur=compte_non_verifie/);

    // …la personne réinitialise le mot de passe (elle lit ce courrier : l'adresse devient vérifiée, l'usurpateur est éjecté)…
    await requestReset(page, account.email);
    const token = tokenOf(resetLink((await mailsFor(request, account.email))[0]));
    expect((await page.request.post("/api/auth/password-reset/confirm", { data: { token, password: NEW_PASSWORD } })).status()).toBe(200);
    expect((await page.request.post("/api/auth/login", { data: { email: account.email, password: account.password } })).status(), "le mot de passe de l'usurpateur ne marche plus").toBe(401);

    // …et Google fonctionne alors.
    await page.goto("/fr/connexion");
    await page.getByRole("link", { name: fr.Auth.googleContinue }).click();
    await expect(page).toHaveURL(/tableau-de-bord/);
    const user = await e2eDb().user.findUniqueOrThrow({ where: { email: account.email }, include: { oauthAccounts: true } });
    expect(user.oauthAccounts.map((o) => o.providerAccountId)).toEqual([google.sub]);
  });

  test("un compte créé avec Google (sans mot de passe) peut s'en donner un, et Google continue de fonctionner", async ({ page, request }) => {
    const identity = { sub: `sub-gsans-${Date.now()}`, email: `google-sans-mdp-${Date.now()}@example.dz`, email_verified: true, name: "Amina Google" };
    await request.post(`${MOCK_GOOGLE}/__control`, { data: { reset: true, identity } });
    await page.goto("/fr/connexion");
    await page.getByRole("link", { name: fr.Auth.googleContinue }).click();
    await expect(page).toHaveURL(/tableau-de-bord/);
    await page.request.post("/api/auth/logout");
    expect((await e2eDb().user.findUniqueOrThrow({ where: { email: identity.email } })).passwordHash).toBeNull();

    await requestReset(page, identity.email);
    const token = tokenOf(resetLink((await mailsFor(request, identity.email))[0]));
    expect((await page.request.post("/api/auth/password-reset/confirm", { data: { token, password: NEW_PASSWORD } })).status()).toBe(200);

    expect((await page.request.post("/api/auth/login", { data: { email: identity.email, password: NEW_PASSWORD } })).status()).toBe(200);
    await page.request.post("/api/auth/logout");
    await page.goto("/fr/connexion");
    await page.getByRole("link", { name: fr.Auth.googleContinue }).click();
    await expect(page).toHaveURL(/tableau-de-bord/);
    expect(await e2eDb().user.count({ where: { email: identity.email } })).toBe(1);
  });

  test("supprimer son compte supprime aussi le lien en attente", async ({ page }) => {
    const account = uniqueAccount("suppr-lien");
    await registerAndLogin(page, "fr", account);
    await requestReset(page, account.email);
    await expect.poll(() => e2eDb().passwordResetToken.count({ where: { user: { email: account.email } } })).toBe(1);

    const user = await e2eDb().user.findUniqueOrThrow({ where: { email: account.email } });
    expect((await page.request.post("/api/profile/delete-account", { data: { password: account.password } })).status()).toBe(200);
    expect(await e2eDb().passwordResetToken.count({ where: { userId: user.id } })).toBe(0);
  });
});

test.describe("pages", () => {
  test("le lien figure sur la connexion (français et arabe) ; les pages ne sont pas indexées et ne transmettent pas leur adresse", async ({ page, request }) => {
    for (const [locale, messages] of [["fr", fr], ["ar", ar]] as const) {
      await page.goto(`/${locale}/connexion`);
      await expect(page.getByRole("link", { name: messages.Auth.forgotPasswordLink })).toHaveAttribute("href", `/${locale}/mot-de-passe-oublie`);
    }

    await page.goto("/fr/mot-de-passe-oublie");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.goto(`/fr/reinitialiser-mot-de-passe/${"a".repeat(43)}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");

    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /*/mot-de-passe-oublie");
    expect(robots).toContain("Disallow: /*/reinitialiser-mot-de-passe");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("mot-de-passe");
  });
});
