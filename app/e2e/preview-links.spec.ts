import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { uniqueAccount, registerAndLogin } from "./fixtures";
import { disconnectE2eDb, e2eDb, makeAdmin } from "./db";
import fr from "../messages/fr.json";
import ar from "../messages/ar.json";

// Lot 146 — les liens de relecture d'un contenu non publié, dans le vrai serveur : un lien donne la LECTURE d'UN contenu à quelqu'un
// qui n'a pas de compte administrateur. Un lien est un secret : les tests éprouvent qu'il n'ouvre que ce qu'il doit (ce contenu, en lecture
// seule), qu'il meurt quand il le doit (expiration, révocation, publication, suppression), qu'il n'est jamais stocké ni journalisé, et
// que seul un administrateur peut le créer, le lister ou le révoquer.
test.afterAll(disconnectE2eDb);
test.setTimeout(120_000);

const P = fr.ArticlePreview;
const L = fr.PreviewLinks;
const stamp = () => Date.now().toString(36);
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

type Kind = "ARTICLE" | "ESSAI" | "GUIDE";
const SECTION: Record<Kind, string> = { ARTICLE: "mag", ESSAI: "essais", GUIDE: "guides" };

function payload(kind: Kind, title: string, publication: unknown) {
  return {
    kind,
    titleFr: title,
    titleAr: `عنوان اختبار الروابط ${title.slice(-6)}`,
    excerptFr: "Résumé de test des liens de relecture : ce contenu sert à vérifier qui peut le lire avant sa publication.",
    excerptAr: "ملخص اختبار روابط المراجعة: هذا المحتوى يخدم التحقق ممن يستطيع قراءته قبل نشره على الموقع.",
    contentFr: "Contenu de test des liens de relecture, écrit pour les tests de bout en bout. ".repeat(4),
    contentAr: "محتوى اختبار روابط المراجعة، مكتوب لاختبارات النظام الشاملة. ".repeat(4),
    publication,
    ...(kind === "ESSAI" && {
      roadTest: { rating: 4, prosFr: "Point fort de test", prosAr: "نقطة قوة للاختبار", consFr: "Point faible de test", consAr: "نقطة ضعف للاختبار", verdictFr: "Verdict de test : ce contenu n'existe que pour les tests.", verdictAr: "حكم تجريبي: هذا المحتوى موجود لاختبارات النظام فقط." },
    }),
    ...(kind === "GUIDE" && {
      guide: { checklistFr: "Vérifier les papiers\nEssayer le véhicule", checklistAr: "التحقق من الوثائق\nتجربة السيارة", adviceFr: "Conseil de test : ne payez jamais avant d'avoir vu le véhicule.", adviceAr: "نصيحة تجريبية: لا تدفع أبدًا قبل أن ترى السيارة." },
    }),
  };
}

async function adminPage(page: Page, prefix: string) {
  const account = uniqueAccount(prefix);
  await registerAndLogin(page, "fr", account);
  await makeAdmin(account.email);
  return account;
}

async function createContent(page: Page, kind: Kind, publication: unknown = { mode: "draft" }) {
  const title = `Relecture ${kind.toLowerCase()} ${stamp()}`;
  const response = await page.request.post("/api/admin/blog", { data: payload(kind, title, publication) });
  expect(response.status(), await response.text()).toBe(201);
  const { id, slug } = (await response.json()).article;
  return { id, slug, title, kind };
}

async function createLink(page: Page, articleId: string, days: unknown = 7) {
  const response = await page.request.post(`/api/admin/blog/${articleId}/preview-links`, { data: { days } });
  return { response, body: response.status() === 201 ? await response.json() : null };
}

// Un visiteur SANS aucun cookie : c'est le relecteur, qui n'a pas de compte.
async function reviewer(browser: Browser): Promise<BrowserContext> {
  return browser.newContext();
}

async function asRole(browser: Browser, role: "PARTICULIER" | "MODERATEUR"): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const account = uniqueAccount(`links-${role.toLowerCase()}`);
  await registerAndLogin(page, "fr", account);
  if (role === "MODERATEUR") await e2eDb().user.update({ where: { email: account.email }, data: { role: "MODERATEUR" } });
  return { context, page };
}

const cleanup = (...ids: string[]) => e2eDb().blogArticle.deleteMany({ where: { id: { in: ids } } });

for (const kind of ["ARTICLE", "ESSAI", "GUIDE"] as const) {
  test.describe(`lien de relecture — ${kind}`, () => {
    test("un relecteur SANS compte lit le brouillon grâce au lien, en français et en arabe, en lecture seule ; sans le lien, rien", async ({ page, browser }) => {
      await adminPage(page, `links-cycle-${kind.toLowerCase()}`);
      const content = await createContent(page, kind);
      const { response, body } = await createLink(page, content.id);
      const stranger = await reviewer(browser);
      try {
        expect(response.status()).toBe(201);
        expect(body.token).toMatch(TOKEN_FORMAT);
        expect(body.paths.fr).toBe(`/fr/${SECTION[kind]}/${content.slug}?apercu=${body.token}`);
        expect(body.paths.ar).toBe(`/ar/${SECTION[kind]}/${content.slug}?apercu=${body.token}`);

        // Sans le lien : le même 404 que pour un contenu inexistant. Avec un mauvais jeton, un jeton mal formé : idem.
        const bare = `/fr/${SECTION[kind]}/${content.slug}`;
        expect((await stranger.request.get(bare)).status(), "sans jeton").toBe(404);
        expect((await stranger.request.get(`${bare}?apercu=${"A".repeat(43)}`)).status(), "mauvais jeton (bonne forme)").toBe(404);
        for (const junk of ["court", "x".repeat(5000), "%00", "../../etc/passwd", `${body.token}x`, body.token.slice(1)]) {
          expect((await stranger.request.get(`${bare}?apercu=${encodeURIComponent(junk)}`)).status(), `jeton absurde ${junk.slice(0, 12)}`).toBe(404);
        }

        // Avec le lien : lecture, dans les deux langues, sous un bandeau DE RELECTURE.
        for (const [locale, path, label] of [["fr", body.paths.fr, P.reviewLabel], ["ar", body.paths.ar, ar.ArticlePreview.reviewLabel]] as const) {
          const reader = await stranger.newPage();
          await reader.goto(path);
          await expect(reader.getByRole("heading", { level: 1 }), locale).toBeVisible();
          const banner = reader.locator("[data-article-preview]");
          await expect(banner).toContainText(label);
          // Lecture SEULE : aucun lien « Modifier », aucun lien vers l'administration.
          await expect(banner.getByRole("link")).toHaveCount(0);
          await expect(reader.locator('a[href*="/admin"]')).toHaveCount(0);
          await reader.close();
        }

        // Ni indexé, ni mis en cache, ni décrit aux moteurs — comme l'aperçu de l'administrateur.
        const raw = await stranger.request.get(body.paths.fr);
        expect(raw.status()).toBe(200);
        const html = await raw.text();
        expect(html).toMatch(/<meta name="robots" content="[^"]*noindex[^"]*"/i);
        expect(html).not.toMatch(/<link rel="canonical"/i);
        expect(html).not.toContain('"@type":"Article"');
        expect(html).not.toContain('"@type":"Review"');
        expect(raw.headers()["cache-control"] ?? "").toMatch(/no-store|private|no-cache/);
        expect(raw.headers()["cache-control"] ?? "").not.toMatch(/\bpublic\b|s-maxage/);
        // L'échéance du lien est annoncée au relecteur.
        expect(html).toContain(String(new Date(body.link.expiresAt).getFullYear()));
      } finally {
        await stranger.close();
        await cleanup(content.id);
      }
    });
  });
}

test.describe("un lien n'ouvre que CE contenu", () => {
  test("le jeton d'un contenu n'ouvre pas un autre contenu, même du même type ni d'un autre type", async ({ page, browser }) => {
    await adminPage(page, "links-isolation");
    const a = await createContent(page, "GUIDE");
    const b = await createContent(page, "GUIDE");
    const c = await createContent(page, "ARTICLE");
    const { body } = await createLink(page, a.id);
    const stranger = await reviewer(browser);
    try {
      expect((await stranger.request.get(`/fr/guides/${a.slug}?apercu=${body.token}`)).status(), "son contenu").toBe(200);
      expect((await stranger.request.get(`/fr/guides/${b.slug}?apercu=${body.token}`)).status(), "un autre guide").toBe(404);
      expect((await stranger.request.get(`/fr/mag/${c.slug}?apercu=${body.token}`)).status(), "un article").toBe(404);
      // Et il ne donne AUCUN accès à l'administration : c'est de la lecture, pas une session.
      expect((await stranger.request.get(`/fr/admin/guides/${a.id}/modifier`, { maxRedirects: 0 })).status()).not.toBe(200);
      expect((await stranger.request.get(`/api/admin/blog/${a.id}/preview-links`)).status()).toBe(403);
    } finally {
      await stranger.close();
      await cleanup(a.id, b.id, c.id);
    }
  });

  test("ouvert par l'ancienne adresse /mag, le lien d'un essai ou d'un guide est renvoyé vers sa rubrique AVEC son jeton", async ({ page, browser }) => {
    await adminPage(page, "links-redirect");
    const guide = await createContent(page, "GUIDE");
    const { body } = await createLink(page, guide.id);
    const stranger = await reviewer(browser);
    try {
      const response = await stranger.request.get(`/fr/mag/${guide.slug}?apercu=${body.token}`);
      expect(response.status()).toBe(200); // les redirections sont suivies : le jeton a survécu au renvoi
      expect(response.url()).toContain(`/fr/guides/${guide.slug}`);
      expect(await response.text()).toContain("data-article-preview");
    } finally {
      await stranger.close();
      await cleanup(guide.id);
    }
  });
});

test.describe("un lien meurt quand il le doit", () => {
  test("révoqué, il cesse de marcher IMMÉDIATEMENT ; la révocation est idempotente et ne touche pas un lien d'un autre contenu", async ({ page, browser }) => {
    await adminPage(page, "links-revoke");
    const a = await createContent(page, "GUIDE");
    const other = await createContent(page, "GUIDE");
    const first = await createLink(page, a.id);
    const second = await createLink(page, a.id);
    const stranger = await reviewer(browser);
    try {
      const url = (token: string) => `/fr/guides/${a.slug}?apercu=${token}`;
      expect((await stranger.request.get(url(first.body.token))).status()).toBe(200);

      // Révoquer un lien PAR L'ADRESSE D'UN AUTRE contenu : introuvable, et le lien reste valable.
      const wrong = await page.request.delete(`/api/admin/blog/${other.id}/preview-links/${first.body.link.id}`);
      expect(wrong.status()).toBe(404);
      expect((await stranger.request.get(url(first.body.token))).status(), "toujours valable").toBe(200);

      const revoked = await page.request.delete(`/api/admin/blog/${a.id}/preview-links/${first.body.link.id}`);
      expect(revoked.status()).toBe(200);
      expect((await stranger.request.get(url(first.body.token))).status(), "révoqué").toBe(404);
      expect((await stranger.request.get(url(second.body.token))).status(), "l'autre lien du même contenu, lui, marche encore").toBe(200);

      // Idempotent : une seconde révocation réussit, et la date d'origine est conservée.
      const before = (await e2eDb().articlePreviewLink.findUniqueOrThrow({ where: { id: first.body.link.id } })).revokedAt;
      expect((await page.request.delete(`/api/admin/blog/${a.id}/preview-links/${first.body.link.id}`)).status()).toBe(200);
      expect((await e2eDb().articlePreviewLink.findUniqueOrThrow({ where: { id: first.body.link.id } })).revokedAt).toEqual(before);
      expect((await page.request.delete(`/api/admin/blog/${a.id}/preview-links/inexistant`)).status()).toBe(404);
    } finally {
      await stranger.close();
      await cleanup(a.id, other.id);
    }
  });

  test("expiré, il cesse de marcher — à l'échéance exacte, pas un instant après", async ({ page, browser }) => {
    await adminPage(page, "links-expiry");
    const content = await createContent(page, "GUIDE");
    const { body } = await createLink(page, content.id);
    const stranger = await reviewer(browser);
    const url = `/fr/guides/${content.slug}?apercu=${body.token}`;
    try {
      expect((await stranger.request.get(url)).status()).toBe(200);
      await e2eDb().articlePreviewLink.update({ where: { id: body.link.id }, data: { expiresAt: new Date(Date.now() + 60_000) } }); // encore une minute
      expect((await stranger.request.get(url)).status(), "une minute avant l'échéance").toBe(200);
      await e2eDb().articlePreviewLink.update({ where: { id: body.link.id }, data: { expiresAt: new Date(Date.now() - 1) } }); // échu
      expect((await stranger.request.get(url)).status(), "échu").toBe(404);
    } finally {
      await stranger.close();
      await cleanup(content.id);
    }
  });

  test("publié, le contenu redevient une page publique ordinaire : le jeton n'y change rien, sans bandeau ; supprimé, ses liens disparaissent", async ({ page, browser }) => {
    await adminPage(page, "links-publish");
    const content = await createContent(page, "GUIDE");
    const { body } = await createLink(page, content.id);
    const stranger = await reviewer(browser);
    try {
      await e2eDb().blogArticle.update({ where: { id: content.id }, data: { publishedAt: new Date(Date.now() - 60_000) } });
      for (const url of [`/fr/guides/${content.slug}`, `/fr/guides/${content.slug}?apercu=${body.token}`]) {
        const response = await stranger.request.get(url);
        expect(response.status(), url).toBe(200);
        const html = await response.text();
        expect(html, "aucun bandeau sur une page publique").not.toContain("data-article-preview");
        expect(html, "indexable").not.toMatch(/name="robots" content="[^"]*noindex/i);
      }
      // Un contenu paru n'a plus de sens pour un lien : on refuse d'en créer un.
      const refused = await createLink(page, content.id);
      expect(refused.response.status()).toBe(409);
      expect((await refused.response.json()).error).toBe("already_published");

      expect(await e2eDb().articlePreviewLink.count({ where: { articleId: content.id } })).toBe(1);
      await e2eDb().blogArticle.delete({ where: { id: content.id } });
      expect(await e2eDb().articlePreviewLink.count({ where: { articleId: content.id } }), "supprimé avec son contenu").toBe(0);
    } finally {
      await stranger.close();
      await cleanup(content.id);
    }
  });

  test("un contenu PROGRAMMÉ se lit aussi par lien", async ({ page, browser }) => {
    await adminPage(page, "links-scheduled");
    const content = await createContent(page, "GUIDE", { mode: "scheduled", at: new Date(Date.now() + 5 * 86_400_000).toISOString() });
    const { body } = await createLink(page, content.id);
    const stranger = await reviewer(browser);
    try {
      expect((await stranger.request.get(`/fr/guides/${content.slug}`)).status()).toBe(404);
      expect((await stranger.request.get(body.paths.fr)).status()).toBe(200);
    } finally {
      await stranger.close();
      await cleanup(content.id);
    }
  });
});

test.describe("le jeton n'est jamais stocké, jamais journalisé, jamais relu", () => {
  test("la base ne garde que son empreinte ; la liste et le journal d'audit ne le contiennent pas", async ({ page }) => {
    const admin = await adminPage(page, "links-secret");
    const content = await createContent(page, "GUIDE");
    const { body } = await createLink(page, content.id);
    try {
      const row = await e2eDb().articlePreviewLink.findUniqueOrThrow({ where: { id: body.link.id } });
      expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.tokenHash).not.toBe(body.token);
      expect(JSON.stringify(row)).not.toContain(body.token); // rien, dans toute la ligne, ne contient le jeton

      // La liste ne renvoie NI le jeton NI son empreinte : il n'existe qu'à la création.
      const listed = await page.request.get(`/api/admin/blog/${content.id}/preview-links`);
      expect(listed.status()).toBe(200);
      const text = await listed.text();
      expect(text).not.toContain(body.token);
      expect(text).not.toContain(row.tokenHash);
      expect(text).not.toMatch(/tokenHash|"token"/);
      expect(JSON.parse(text).links[0]).toMatchObject({ id: body.link.id, state: "active", createdBy: admin.email });
      expect(listed.headers()["cache-control"]).toContain("no-store");

      // Le journal d'audit trace la création et la révocation, sans le jeton ni son empreinte.
      await page.request.delete(`/api/admin/blog/${content.id}/preview-links/${body.link.id}`);
      const audits = await e2eDb().auditLog.findMany({ where: { targetId: content.id, action: { startsWith: "article_preview_link." } }, orderBy: { createdAt: "asc" } });
      expect(audits.map((a) => a.action)).toEqual(["article_preview_link.create", "article_preview_link.revoke"]);
      for (const audit of audits) {
        const serialized = JSON.stringify(audit);
        expect(serialized).not.toContain(body.token);
        expect(serialized).not.toContain(row.tokenHash);
        expect(JSON.parse(audit.details ?? "{}").linkId).toBe(body.link.id);
      }
      // La réponse de création n'est pas non plus mise en cache.
      const again = await createLink(page, content.id);
      expect(again.response.headers()["cache-control"]).toContain("no-store");
    } finally {
      await cleanup(content.id);
    }
  });
});

test.describe("qui peut créer, lister et révoquer", () => {
  test("seul un administrateur : anonyme, membre et modérateur reçoivent 403 sur les trois routes, et rien n'est créé", async ({ page, browser }) => {
    await adminPage(page, "links-rights");
    const content = await createContent(page, "GUIDE");
    const { body } = await createLink(page, content.id);
    const anonymous = await reviewer(browser);
    const member = await asRole(browser, "PARTICULIER");
    const moderator = await asRole(browser, "MODERATEUR");
    try {
      const before = await e2eDb().articlePreviewLink.count({ where: { articleId: content.id } });
      for (const [who, request] of [["anonyme", anonymous.request], ["membre", member.page.request], ["modérateur", moderator.page.request]] as const) {
        expect((await request.post(`/api/admin/blog/${content.id}/preview-links`, { data: { days: 7 } })).status(), `${who} : créer`).toBe(403);
        expect((await request.get(`/api/admin/blog/${content.id}/preview-links`)).status(), `${who} : lister`).toBe(403);
        expect((await request.delete(`/api/admin/blog/${content.id}/preview-links/${body.link.id}`)).status(), `${who} : révoquer`).toBe(403);
      }
      expect(await e2eDb().articlePreviewLink.count({ where: { articleId: content.id } }), "rien n'a été créé").toBe(before);
      expect((await e2eDb().articlePreviewLink.findUniqueOrThrow({ where: { id: body.link.id } })).revokedAt, "rien n'a été révoqué").toBeNull();
    } finally {
      await Promise.all([anonymous.close(), member.context.close(), moderator.context.close()]);
      await cleanup(content.id);
    }
  });

  test("valide la durée (liste fermée), l'existence du contenu, et plafonne le nombre de liens actifs", async ({ page }) => {
    await adminPage(page, "links-validation");
    const content = await createContent(page, "GUIDE");
    try {
      // (`undefined` est testé à part, en n'envoyant aucune durée : passé à l'aide ci-dessous, il déclencherait sa valeur par défaut.)
      for (const bad of [0, 2, 31, 365, -7, 7.5, "7", null, {}]) {
        expect((await createLink(page, content.id, bad)).response.status(), `durée ${JSON.stringify(bad)}`).toBe(400);
      }
      expect((await page.request.post(`/api/admin/blog/${content.id}/preview-links`, { data: {} })).status(), "sans durée").toBe(400);
      expect((await createLink(page, "inexistant")).response.status(), "contenu inexistant").toBe(404);
      expect((await page.request.get("/api/admin/blog/inexistant/preview-links")).status()).toBe(404);
      expect(await e2eDb().articlePreviewLink.count({ where: { articleId: content.id } }), "aucune durée invalide n'a créé de lien").toBe(0);

      for (const days of [1, 3, 7, 14, 30]) expect((await createLink(page, content.id, days)).response.status(), `${days} jours`).toBe(201);
      const rows = await e2eDb().articlePreviewLink.findMany({ where: { articleId: content.id }, orderBy: { createdAt: "asc" } });
      expect(rows).toHaveLength(5);
      // Chaque échéance est bien « maintenant + N jours » (à quelques secondes de test près).
      rows.forEach((row, index) => expect(Math.abs(row.expiresAt.getTime() - row.createdAt.getTime() - [1, 3, 7, 14, 30][index] * 86_400_000)).toBeLessThan(5_000));

      // Le plafond : dix liens ACTIFS, pas un de plus ; en révoquer un libère une place.
      for (let i = rows.length; i < 10; i++) expect((await createLink(page, content.id)).response.status()).toBe(201);
      const over = await createLink(page, content.id);
      expect(over.response.status()).toBe(409);
      expect((await over.response.json()).error).toBe("too_many");
      const [oldest] = await e2eDb().articlePreviewLink.findMany({ where: { articleId: content.id }, orderBy: { createdAt: "asc" }, take: 1 });
      await page.request.delete(`/api/admin/blog/${content.id}/preview-links/${oldest.id}`);
      expect((await createLink(page, content.id)).response.status(), "une place libérée").toBe(201);
    } finally {
      await cleanup(content.id);
    }
  });
});

test.describe("l'écran d'administration", () => {
  test("crée un lien (copiable, français et arabe), le montre UNE fois, l'inscrit dans la liste avec sa consultation, et le révoque", async ({ page, browser }) => {
    await adminPage(page, "links-ui");
    const content = await createContent(page, "GUIDE");
    const stranger = await reviewer(browser);
    try {
      await page.goto(`/fr/admin/guides/${content.id}/modifier`);
      const section = page.getByRole("region", { name: L.title });
      await expect(section).toBeVisible();
      await expect(section.getByText(L.none)).toBeVisible();

      await section.getByLabel(L.durationLabel).selectOption("3");
      await section.getByRole("button", { name: L.create }).click();
      const created = section.getByRole("status");
      await expect(created).toContainText(L.createdTitle);
      await expect(created).toContainText(L.createdWarning);
      const frUrl = await created.getByLabel(L.linkFr).inputValue();
      const arUrl = await created.getByLabel(L.linkAr).inputValue();
      expect(frUrl).toMatch(new RegExp(`/fr/guides/${content.slug}\\?apercu=[A-Za-z0-9_-]{43}$`));
      expect(arUrl).toMatch(new RegExp(`/ar/guides/${content.slug}\\?apercu=[A-Za-z0-9_-]{43}$`));

      // La liste : un lien actif, jamais consulté. Le jeton n'y figure pas.
      await expect(section.getByRole("listitem")).toHaveCount(1);
      await expect(section.getByRole("listitem")).toContainText(L.stateActive);
      await expect(section.getByRole("listitem")).toContainText(L.neverUsed);
      expect(await section.getByRole("listitem").innerText()).not.toContain(frUrl.split("apercu=")[1]);

      // Le relecteur ouvre le lien copié : il lit le guide, et la liste note sa consultation.
      const reader = await stranger.newPage();
      await reader.goto(frUrl);
      await expect(reader.locator("[data-article-preview]")).toContainText(P.reviewLabel);
      await reader.close();
      await page.reload();
      const reloaded = page.getByRole("region", { name: L.title });
      await expect(reloaded.getByRole("listitem")).toContainText(L.usedOn.split("{date}")[0].trim());
      await expect(reloaded.getByText(L.createdTitle), "le lien n'est plus affichable après rechargement").toHaveCount(0);

      // Révocation : confirmation, état « Révoqué », et le lien cesse de marcher.
      page.once("dialog", (dialog) => void dialog.accept());
      await reloaded.getByRole("button", { name: L.revoke }).click();
      await expect(reloaded.getByRole("listitem")).toContainText(L.stateRevoked);
      await expect(reloaded.getByRole("button", { name: L.revoke })).toHaveCount(0);
      expect((await stranger.request.get(frUrl)).status()).toBe(404);
    } finally {
      await stranger.close();
      await cleanup(content.id);
    }
  });

  test("un contenu PUBLIÉ n'a pas de section « lien de relecture »", async ({ page }) => {
    await adminPage(page, "links-ui-published");
    const content = await createContent(page, "GUIDE", { mode: "now" });
    try {
      await page.goto(`/fr/admin/guides/${content.id}/modifier`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("region", { name: L.title })).toHaveCount(0);
    } finally {
      await cleanup(content.id);
    }
  });
});
