import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { uniqueAccount, registerAndLogin, giveOwnClientIp } from "./fixtures";
import { disconnectE2eDb, e2eDb } from "./db";
import fr from "../messages/fr.json";
import ar from "../messages/ar.json";

// Lot 132 — « Continuer avec Google », de bout en bout, contre un FAUX serveur Google (e2e/mock-google.mjs, port 5187) :
// le vrai site, la vraie base, le vrai cookie de déroulement, le vrai PKCE ; seules les deux adresses de Google sont
// remplacées. Le faux serveur refuse une demande mal formée comme le ferait Google (mauvais secret, code réutilisé,
// vérificateur PKCE qui ne correspond pas), donc un test qui réussit prouve que le site envoie des demandes correctes.
//
// CE QUE CES TESTS NE PROUVENT PAS : que Google accepte les identifiants du site et l'adresse de retour déclarée, et que
// l'écran de consentement fonctionne. Cela ne se vérifie qu'avec de vrais identifiants Google (docs/EXPLOITATION.md).
test.afterAll(disconnectE2eDb);

const MOCK = "http://localhost:5187";

type Identity = { sub: string; email: string; email_verified?: boolean; name?: string };

async function control(request: APIRequestContext, body: { identity?: Identity; behavior?: string; reset?: boolean }) {
  const response = await request.post(`${MOCK}/__control`, { data: body });
  expect(response.status()).toBe(204);
}

// Une identité Google neuve à chaque test (jamais la même adresse ni le même identifiant Google d'un test à l'autre).
function newIdentity(prefix: string, name = "Amina Google"): Identity {
  const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  return { sub: `sub-${prefix}-${id}`, email: `google-${prefix}-${id}@example.dz`, email_verified: true, name };
}

async function continueWithGoogle(page: Page, locale: "fr" | "ar" = "fr") {
  await page.goto(`/${locale}/connexion`);
  await page.getByRole("link", { name: locale === "fr" ? fr.Auth.googleContinue : ar.Auth.googleContinue }).click();
}

const alertText = (page: Page) => page.getByRole("alert");
async function expectRefusal(page: Page, code: string, message: string) {
  await expect(page).toHaveURL(new RegExp(`/connexion\\?erreur=${code}`));
  await expect(alertText(page)).toHaveText(message);
  expect((await page.request.get("/api/auth/me")).status(), "aucune session ne doit avoir été ouverte").toBe(401);
}

test.beforeEach(async ({ page, request }) => {
  await control(request, { reset: true });
  await giveOwnClientIp(page); // les limites de débit (par adresse) ne doivent pas être partagées entre les tests
});

test.describe("le bouton et les messages", () => {
  test("le bouton figure sur la connexion et l'inscription, dans les deux langues, avec le bon lien", async ({ page }) => {
    for (const [locale, messages] of [["fr", fr], ["ar", ar]] as const) {
      for (const path of ["connexion", "inscription"]) {
        await page.goto(`/${locale}/${path}`);
        const button = page.getByRole("link", { name: messages.Auth.googleContinue });
        await expect(button, `${locale}/${path}`).toBeVisible();
        await expect(button).toHaveAttribute("href", new RegExp(`^/api/auth/google/start\\?locale=${locale}`));
        await expect(button.locator("svg")).toHaveCount(1); // le logo « G »
      }
    }
    await page.goto("/ar/connexion");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("un message d'erreur ne s'affiche que pour un code connu, jamais pour une valeur quelconque de l'adresse", async ({ page }) => {
    await page.goto("/fr/connexion?erreur=google_annule");
    await expect(alertText(page)).toHaveText(fr.Auth.googleError_google_annule);
    await page.goto("/fr/connexion?erreur=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
    await expect(alertText(page)).toHaveCount(0);
    await page.goto("/fr/connexion?erreur=inconnu");
    await expect(alertText(page)).toHaveCount(0);
  });
});

test.describe("première connexion et connexions suivantes", () => {
  test("crée le compte, sans mot de passe, adresse vérifiée, et ne garde de Google que son identifiant", async ({ page, request, context }) => {
    const identity = newIdentity("nouveau");
    await control(request, { identity });
    await continueWithGoogle(page);

    await expect(page).toHaveURL(/\/fr\/compte\/tableau-de-bord/);
    await expect(page.getByText("Amina Google").first()).toBeVisible();

    const user = await e2eDb().user.findUniqueOrThrow({ where: { email: identity.email }, include: { profile: true, oauthAccounts: true } });
    expect(user.passwordHash).toBeNull();
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.role).toBe("PARTICULIER");
    expect(user.locale).toBe("fr");
    expect(user.profile?.displayName).toBe("Amina Google");
    expect(user.oauthAccounts).toHaveLength(1);
    expect(user.oauthAccounts[0]).toMatchObject({ provider: "google", providerAccountId: identity.sub });
    // Minimisation : le lien ne contient que l'identifiant Google (ni adresse, ni nom, ni photo).
    expect(Object.keys(user.oauthAccounts[0]).sort()).toEqual(["createdAt", "id", "provider", "providerAccountId", "userId"]);

    // Cookies : la session est là (illisible par script), le cookie de déroulement est supprimé (usage unique).
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "souq_auto_session")?.httpOnly).toBe(true);
    expect(cookies.some((c) => c.name === "souq_auto_google_flow")).toBe(false);
  });

  test("une deuxième connexion retrouve le même compte, sans doublon", async ({ page, request }) => {
    const identity = newIdentity("retour");
    await control(request, { identity });
    await continueWithGoogle(page);
    await expect(page).toHaveURL(/tableau-de-bord/);
    const first = await e2eDb().user.findUniqueOrThrow({ where: { email: identity.email } });

    await page.request.post("/api/auth/logout");
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
    await continueWithGoogle(page);
    await expect(page).toHaveURL(/tableau-de-bord/);

    expect(await e2eDb().user.count({ where: { email: identity.email } })).toBe(1);
    expect(await e2eDb().oAuthAccount.count({ where: { userId: first.id } })).toBe(1);
    const me = await (await page.request.get("/api/auth/me")).json();
    expect(me.user.id).toBe(first.id);
  });

  test("la connexion depuis la version arabe revient sur la version arabe, et enregistre la langue", async ({ page, request }) => {
    const identity = newIdentity("arabe", "أمينة");
    await control(request, { identity });
    await continueWithGoogle(page, "ar");
    await expect(page).toHaveURL(/\/ar\/compte\/tableau-de-bord/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect((await e2eDb().user.findUniqueOrThrow({ where: { email: identity.email } })).locale).toBe("ar");
  });
});

test.describe("compte du site déjà existant à la même adresse", () => {
  test("adresse vérifiée : le compte Google est rattaché, le mot de passe continue de fonctionner", async ({ page, request }) => {
    const account = uniqueAccount("existant");
    await registerAndLogin(page, "fr", account);
    await e2eDb().user.update({ where: { email: account.email }, data: { emailVerifiedAt: new Date() } });
    const before = await e2eDb().user.findUniqueOrThrow({ where: { email: account.email } });
    await page.request.post("/api/auth/logout");

    const identity = { sub: `sub-lie-${Date.now()}`, email: account.email, email_verified: true, name: "Nom venu de Google" };
    await control(request, { identity });
    await continueWithGoogle(page);
    await expect(page).toHaveURL(/tableau-de-bord/);

    expect((await (await page.request.get("/api/auth/me")).json()).user.id).toBe(before.id);
    expect(await e2eDb().user.count({ where: { email: account.email } })).toBe(1);
    expect(await e2eDb().oAuthAccount.count({ where: { userId: before.id, providerAccountId: identity.sub } })).toBe(1);
    // Le compte n'a pas été modifié par le rattachement : même mot de passe, même nom affiché.
    const after = await e2eDb().user.findUniqueOrThrow({ where: { id: before.id }, include: { profile: true } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.profile?.displayName).toBe(account.displayName);

    await page.request.post("/api/auth/logout");
    const password = await page.request.post("/api/auth/login", { data: { email: account.email, password: account.password } });
    expect(password.status()).toBe(200);
  });

  test("adresse NON vérifiée : refus, pour ne pas donner ce compte à celui qui s'y est inscrit le premier", async ({ page, request }) => {
    // Scénario d'usurpation : quelqu'un s'inscrit avec l'adresse d'un autre, avec SON mot de passe, avant lui.
    const usurpateur = uniqueAccount("usurpe");
    await registerAndLogin(page, "fr", usurpateur);
    await page.request.post("/api/auth/logout");

    await control(request, { identity: { sub: `sub-victime-${Date.now()}`, email: usurpateur.email, email_verified: true, name: "La vraie personne" } });
    await continueWithGoogle(page);

    await expectRefusal(page, "compte_non_verifie", fr.Auth.googleError_compte_non_verifie);
    const account = await e2eDb().user.findUniqueOrThrow({ where: { email: usurpateur.email }, include: { oauthAccounts: true } });
    expect(account.oauthAccounts).toHaveLength(0); // aucun lien créé
    expect(account.emailVerifiedAt).toBeNull(); // rien n'a été « vérifié » à la place de la personne
  });

  test("compte de l'équipe (administrateur) : refus, la connexion reste par mot de passe", async ({ page, request }) => {
    const admin = uniqueAccount("equipe");
    await registerAndLogin(page, "fr", admin);
    await e2eDb().user.update({ where: { email: admin.email }, data: { role: "ADMIN", emailVerifiedAt: new Date() } });
    await page.request.post("/api/auth/logout");

    await control(request, { identity: { sub: `sub-equipe-${Date.now()}`, email: admin.email, email_verified: true, name: "Quelqu'un" } });
    await continueWithGoogle(page);

    await expectRefusal(page, "compte_equipe", fr.Auth.googleError_compte_equipe);
    expect(await e2eDb().oAuthAccount.count({ where: { user: { email: admin.email } } })).toBe(0);
  });

  test("compte suspendu : refus", async ({ page, request }) => {
    const account = uniqueAccount("suspendu");
    await registerAndLogin(page, "fr", account);
    await e2eDb().user.update({ where: { email: account.email }, data: { emailVerifiedAt: new Date(), suspendedAt: new Date(), suspensionReason: "Test" } });
    await page.request.post("/api/auth/logout");

    await control(request, { identity: { sub: `sub-susp-${Date.now()}`, email: account.email, email_verified: true, name: "Suspendu" } });
    await continueWithGoogle(page);
    await expectRefusal(page, "compte_suspendu", fr.Auth.googleError_compte_suspendu);
  });
});

test.describe("Google refuse, ou répond mal", () => {
  test("la personne annule : message clair, aucun compte", async ({ page, request }) => {
    const identity = newIdentity("annule");
    await control(request, { identity, behavior: "cancel" });
    await continueWithGoogle(page);
    await expectRefusal(page, "google_annule", fr.Auth.googleError_google_annule);
    expect(await e2eDb().user.count({ where: { email: identity.email } })).toBe(0);
  });

  test("Google signale une erreur de son côté : message « Google n'a pas répondu »", async ({ page, request }) => {
    await control(request, { identity: newIdentity("erreur"), behavior: "error" });
    await continueWithGoogle(page);
    await expectRefusal(page, "google_echec", fr.Auth.googleError_google_echec);
  });

  test("Google ne confirme pas l'adresse e-mail : refus, aucun compte", async ({ page, request }) => {
    const identity = { ...newIdentity("nonverif"), email_verified: false };
    await control(request, { identity });
    await continueWithGoogle(page);
    await expectRefusal(page, "google_email_non_verifie", fr.Auth.googleError_google_email_non_verifie);
    expect(await e2eDb().user.count({ where: { email: identity.email } })).toBe(0);
  });

  for (const behavior of ["wrong_nonce", "expired", "wrong_issuer", "wrong_audience", "bad_token"]) {
    test(`jeton d'identité invalide (${behavior}) : refus, aucun compte, aucune session`, async ({ page, request }) => {
      const identity = newIdentity(behavior);
      await control(request, { identity, behavior });
      await continueWithGoogle(page);
      await expectRefusal(page, "google_invalide", fr.Auth.googleError_google_invalide);
      expect(await e2eDb().user.count({ where: { email: identity.email } })).toBe(0);
      expect(await e2eDb().oAuthAccount.count({ where: { providerAccountId: identity.sub } })).toBe(0);
    });
  }
});

test.describe("attaques sur le déroulement", () => {
  test("la demande envoyée à Google est complète, propre à chaque tentative, et sans le secret", async ({ page }) => {
    const start = () => page.request.get("/api/auth/google/start?locale=fr", { maxRedirects: 0 });
    const first = await start();
    const second = await start();
    expect([first.status(), second.status()]).toEqual([302, 302]);

    const a = new URL(first.headers()["location"]);
    const b = new URL(second.headers()["location"]);
    expect(a.origin).toBe(MOCK); // en test : le faux serveur ; en production : accounts.google.com
    expect(a.searchParams.get("client_id")).toBe("e2e-client.apps.googleusercontent.com");
    expect(a.searchParams.get("redirect_uri")).toBe("http://localhost:5185/api/auth/google/callback");
    expect(a.searchParams.get("scope")).toBe("openid email profile");
    expect(a.searchParams.get("code_challenge_method")).toBe("S256");
    expect(a.searchParams.get("prompt")).toBe("select_account");
    expect(a.searchParams.get("hl")).toBe("fr");
    for (const name of ["state", "nonce", "code_challenge"]) {
      expect(a.searchParams.get(name)!.length, name).toBeGreaterThanOrEqual(43);
      expect(a.searchParams.get(name), `${name} doit changer à chaque tentative`).not.toBe(b.searchParams.get(name));
    }
    expect(first.headers()["location"]).not.toContain("e2e-secret-factice");
    expect(first.headers()["location"]).not.toContain("code_verifier");

    const cookie = first.headers()["set-cookie"];
    expect(cookie).toContain("souq_auto_google_flow=");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\/api\/auth\/google/);
    expect(cookie).toMatch(/Max-Age=600/);
  });

  test("un retour sans cookie de déroulement, avec un mauvais état, ou avec un cookie falsifié est refusé", async ({ page, context }) => {
    const callback = (query: string) => page.request.get(`/api/auth/google/callback?${query}`, { maxRedirects: 0 });
    const refused = (response: Awaited<ReturnType<typeof callback>>) => {
      expect(response.status()).toBe(302);
      expect(response.headers()["location"]).toMatch(/\/connexion\?erreur=google_invalide$/);
    };

    // 1. Aucun cookie.
    refused(await callback("code=un-code&state=un-etat"));

    // 2. Cookie valide, mauvais état (attaque par fixation : le lien vient d'une autre tentative).
    await page.request.get("/api/auth/google/start?locale=fr", { maxRedirects: 0 });
    refused(await callback("code=un-code&state=un-etat-different"));
    // Le cookie est à usage unique : même avec le bon état ensuite, il n'existe plus.
    expect((await context.cookies()).some((c) => c.name === "souq_auto_google_flow")).toBe(false);

    // 3. Cookie falsifié (non signé par le site).
    await context.addCookies([{ name: "souq_auto_google_flow", value: "n-importe-quoi", url: "http://localhost:5185/api/auth/google" }]);
    refused(await callback("code=un-code&state=un-etat"));

    // 4. Cookie signé par le site MAIS de session : ne doit jamais servir de cookie de déroulement.
    const session = await registerAndLoginAndReadSession(page);
    await context.addCookies([{ name: "souq_auto_google_flow", value: session, url: "http://localhost:5185/api/auth/google" }]);
    refused(await callback("code=un-code&state=un-etat"));
  });

  test("un retour déjà utilisé ne rouvre pas de session", async ({ page, request, browser }) => {
    await control(request, { identity: newIdentity("rejeu") });
    let callbackUrl = "";
    page.on("request", (r) => {
      if (r.url().includes("/api/auth/google/callback")) callbackUrl = r.url();
    });
    await continueWithGoogle(page);
    await expect(page).toHaveURL(/tableau-de-bord/);
    expect(callbackUrl).toContain("code=");

    // Même adresse de retour rejouée, depuis un autre navigateur (sans le cookie de déroulement) : refusée.
    const other = await browser.newContext();
    const replay = await other.request.get(callbackUrl, { maxRedirects: 0 });
    expect(replay.headers()["location"]).toMatch(/erreur=google_invalide/);
    expect((await other.request.get("/api/auth/me")).status()).toBe(401);
    await other.close();
  });

  test("l'adresse de retour ne peut mener que vers une page du site (pas de redirection ouverte)", async ({ page, request }) => {
    const cases: [string, RegExp][] = [
      ["/compte/favoris", /\/fr\/compte\/favoris$/],
      ["/fr/compte/favoris", /\/fr\/compte\/favoris$/],
      ["//evil.example/piege", /\/fr\/compte\/tableau-de-bord$/],
      ["https://evil.example", /\/fr\/compte\/tableau-de-bord$/],
      ["/\\evil.example", /\/fr\/compte\/tableau-de-bord$/],
      ["/api/auth/logout", /\/fr\/compte\/tableau-de-bord$/],
      ["/../../etc/passwd", /\/fr\/compte\/tableau-de-bord$/],
    ];
    for (const [next, expected] of cases) {
      await control(request, { identity: newIdentity("next") });
      await page.request.post("/api/auth/logout");
      await page.goto(`/api/auth/google/start?locale=fr&next=${encodeURIComponent(next)}`);
      await expect(page, next).toHaveURL(expected);
      expect(new URL(page.url()).origin, next).toBe("http://localhost:5185");
    }
  });

  test("le nombre de départs est limité par adresse, sans bloquer les autres visiteurs", async ({ page, browser }) => {
    const statuses: string[] = [];
    for (let i = 0; i < 22; i++) {
      const r = await page.request.get("/api/auth/google/start?locale=fr", { maxRedirects: 0 });
      statuses.push(r.headers()["location"].includes("erreur=trop_de_tentatives") ? "limité" : "ok");
    }
    expect(statuses.slice(0, 20).every((s) => s === "ok")).toBe(true);
    expect(statuses.slice(20)).toEqual(["limité", "limité"]);

    // Une autre adresse n'est pas touchée.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await giveOwnClientIp(otherPage);
    const r = await otherPage.request.get("/api/auth/google/start?locale=fr", { maxRedirects: 0 });
    expect(r.headers()["location"]).toMatch(new RegExp(`^${MOCK}/auth`));
    await other.close();
  });
});

test.describe("compte créé avec Google : connexion par mot de passe et suppression", () => {
  test("la connexion par mot de passe est impossible, avec la même réponse qu'un mot de passe faux", async ({ page, request }) => {
    const identity = newIdentity("sanspass");
    await control(request, { identity });
    await continueWithGoogle(page);
    await expect(page).toHaveURL(/tableau-de-bord/);
    await page.request.post("/api/auth/logout");

    for (const password of ["", "n-importe-quoi", "null", "undefined", "  "]) {
      const r = await page.request.post("/api/auth/login", { data: { email: identity.email, password: password || "x" } });
      expect(r.status(), password).toBe(401);
      expect(await r.json()).toEqual({ error: "invalid_credentials" });
    }
    const unknown = await page.request.post("/api/auth/login", { data: { email: `inconnu-${Date.now()}@example.dz`, password: "n-importe-quoi" } });
    expect(unknown.status()).toBe(401);
    expect(await unknown.json()).toEqual({ error: "invalid_credentials" });
  });

  test("elle se supprime en confirmant l'adresse e-mail ; le lien avec Google est rompu et ne rouvre pas le compte", async ({ page, request }) => {
    const identity = newIdentity("suppr");
    await control(request, { identity });
    await continueWithGoogle(page);
    await expect(page).toHaveURL(/tableau-de-bord/);
    const original = await e2eDb().user.findUniqueOrThrow({ where: { email: identity.email } });

    await page.goto("/fr/compte/profil");
    await page.getByRole("button", { name: fr.ProfileEdit.deleteAccountAction }).click();
    await expect(page.getByText(fr.ProfileEdit.deleteAccountEmailLabel)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0); // pas de champ mot de passe : il n'y en a pas

    // Mauvaise adresse : refusé, rien n'est supprimé.
    await page.locator('input[type="email"]').last().fill("autre@example.dz");
    await page.getByRole("button", { name: fr.ProfileEdit.deleteAccountConfirm }).click();
    await expect(page.getByText(fr.ProfileEdit.deleteAccountWrongConfirmation)).toBeVisible();
    expect((await e2eDb().user.findUniqueOrThrow({ where: { id: original.id } })).deletedAt).toBeNull();

    // Bonne adresse (casse ignorée) : supprimé.
    await page.locator('input[type="email"]').last().fill(identity.email.toUpperCase());
    await page.getByRole("button", { name: fr.ProfileEdit.deleteAccountConfirm }).click();
    await expect(page.getByText(fr.ProfileEdit.deleteAccountDone)).toBeVisible();

    const deleted = await e2eDb().user.findUniqueOrThrow({ where: { id: original.id } });
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.email).not.toBe(identity.email); // adresse anonymisée
    expect(await e2eDb().oAuthAccount.count({ where: { userId: original.id } })).toBe(0);

    // Le même compte Google ne rouvre PAS le compte anonymisé : un compte neuf est créé.
    await page.context().clearCookies();
    await giveOwnClientIp(page);
    await control(request, { identity });
    await continueWithGoogle(page);
    await expect(page).toHaveURL(/tableau-de-bord/);
    const fresh = await e2eDb().user.findUniqueOrThrow({ where: { email: identity.email } });
    expect(fresh.id).not.toBe(original.id);
    expect((await e2eDb().user.findUniqueOrThrow({ where: { id: original.id } })).deletedAt).not.toBeNull();
  });

  test("un compte avec mot de passe doit toujours le donner pour se supprimer : l'adresse e-mail ne le remplace pas", async ({ page }) => {
    const account = uniqueAccount("suppr-mdp");
    await registerAndLogin(page, "fr", account);
    const r = await page.request.post("/api/profile/delete-account", { data: { confirmEmail: account.email } });
    expect(r.status()).toBe(400);
    expect(await r.json()).toEqual({ error: "wrong_password" });
    expect((await e2eDb().user.findUniqueOrThrow({ where: { email: account.email } })).deletedAt).toBeNull();
  });
});

// Ouvre une session par l'inscription et renvoie la valeur du cookie de session (un jeton signé par le site).
async function registerAndLoginAndReadSession(page: Page): Promise<string> {
  await registerAndLogin(page, "fr", uniqueAccount("cookie"));
  const cookie = (await page.context().cookies()).find((c) => c.name === "souq_auto_session");
  expect(cookie).toBeDefined();
  return cookie!.value;
}
