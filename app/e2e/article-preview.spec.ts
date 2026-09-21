import { test, expect, type Browser, type Page } from "@playwright/test";
import { uniqueAccount, registerAndLogin } from "./fixtures";
import { disconnectE2eDb, e2eDb, makeAdmin } from "./db";
import fr from "../messages/fr.json";
import ar from "../messages/ar.json";

// Lot 145 — l'APERÇU d'un contenu non publié (brouillon ou programmé), réservé aux administrateurs : magazine, essais et guides, dans
// le vrai serveur. Les tests éprouvent l'ACCÈS avant tout : un brouillon ne doit JAMAIS être visible de quelqu'un d'autre qu'un
// administrateur connecté — ni du public, ni d'un membre, ni d'un modérateur — et l'aperçu ne doit jamais être indexé ni mis en cache.
test.afterAll(disconnectE2eDb);
test.setTimeout(120_000);

const P = fr.ArticlePreview;
const stamp = () => Date.now().toString(36);

type Kind = "ARTICLE" | "ESSAI" | "GUIDE";
const SECTION: Record<Kind, { pub: string; admin: string }> = {
  ARTICLE: { pub: "mag", admin: "mag" },
  ESSAI: { pub: "essais", admin: "essais" },
  GUIDE: { pub: "guides", admin: "guides" },
};

function payload(kind: Kind, title: string, publication: unknown) {
  return {
    kind,
    titleFr: title,
    titleAr: `عنوان اختبار المعاينة ${title.slice(-6)}`,
    excerptFr: "Résumé de test de l'aperçu : ce contenu sert à vérifier qui peut le voir avant sa publication.",
    excerptAr: "ملخص اختبار المعاينة: هذا المحتوى يخدم التحقق ممن يستطيع رؤيته قبل نشره على الموقع.",
    contentFr: "Contenu de test de l'aperçu, écrit pour les tests de bout en bout. ".repeat(4),
    contentAr: "محتوى اختبار المعاينة، مكتوب لاختبارات النظام الشاملة. ".repeat(4),
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

async function createContent(page: Page, kind: Kind, publication: unknown): Promise<{ id: string; slug: string; title: string }> {
  const title = `Aperçu ${kind.toLowerCase()} ${stamp()}`;
  const response = await page.request.post("/api/admin/blog", { data: payload(kind, title, publication) });
  expect(response.status(), await response.text()).toBe(201);
  const { id, slug } = (await response.json()).article;
  return { id, slug, title };
}

// Un visiteur d'un rôle donné, dans son propre contexte de navigateur (cookies séparés).
async function viewer(browser: Browser, role: "PARTICULIER" | "MODERATEUR" | null): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  if (role !== null) {
    const account = uniqueAccount(`preview-${role.toLowerCase()}`);
    await registerAndLogin(page, "fr", account);
    if (role === "MODERATEUR") await e2eDb().user.update({ where: { email: account.email }, data: { role: "MODERATEUR" } });
  }
  return page;
}

const futureIso = () => new Date(Date.now() + 5 * 24 * 3_600_000).toISOString();

for (const kind of ["ARTICLE", "ESSAI", "GUIDE"] as const) {
  test.describe(`aperçu d'un contenu de type ${kind}`, () => {
    test("un brouillon ne se voit que de l'administrateur : le public, un membre et un modérateur reçoivent un 404, dans les deux langues", async ({ page, browser }) => {
      await adminPage(page, `preview-admin-${kind.toLowerCase()}`);
      const content = await createContent(page, kind, { mode: "draft" });
      const url = (locale: string) => `/${locale}/${SECTION[kind].pub}/${content.slug}`;
      const others: [string, Page][] = [["anonyme", await viewer(browser, null)], ["membre", await viewer(browser, "PARTICULIER")], ["modérateur", await viewer(browser, "MODERATEUR")]];

      try {
        for (const [who, other] of others) {
          for (const locale of ["fr", "ar"]) {
            const response = await other.request.get(url(locale));
            expect(response.status(), `${who} (${locale})`).toBe(404);
            // Le corps ne trahit rien : ni le titre, ni le bandeau. (Le TEXTE du bandeau figure dans le dictionnaire envoyé avec toutes
            // les pages : c'est l'élément du bandeau qu'on cherche, pas sa phrase.)
            const body = await response.text();
            expect(body, `${who} (${locale}) : le titre ne fuit pas`).not.toContain(content.title);
            expect(body, `${who} (${locale}) : pas de bandeau`).not.toContain("data-article-preview");
          }
          // Même « rien » que pour un contenu qui n'existe pas : rien ne distingue le brouillon de l'inexistant.
          const missing = await other.request.get(`/fr/${SECTION[kind].pub}/inexistant-${stamp()}`);
          expect(missing.status(), `${who} : contenu inexistant`).toBe(404);
        }

        // L'administrateur, lui, voit l'aperçu : 200, sous un bandeau, dans les deux langues.
        for (const [locale, label] of [["fr", P.label], ["ar", ar.ArticlePreview.label]] as const) {
          await page.goto(url(locale));
          await expect(page.getByRole("status").filter({ hasText: label })).toBeVisible();
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        }
        await page.goto(url("fr"));
        await expect(page.getByRole("status")).toContainText(P.draft);
      } finally {
        await Promise.all(others.map(([, other]) => other.context().close()));
        await e2eDb().blogArticle.deleteMany({ where: { id: content.id } });
      }
    });

    test("un contenu programmé s'aperçoit avec sa date ; il reste un 404 pour les autres", async ({ page, browser }) => {
      await adminPage(page, `preview-sched-${kind.toLowerCase()}`);
      const at = futureIso();
      const content = await createContent(page, kind, { mode: "scheduled", at });
      const anonymous = await viewer(browser, null);
      try {
        expect((await anonymous.request.get(`/fr/${SECTION[kind].pub}/${content.slug}`)).status()).toBe(404);
        await page.goto(`/fr/${SECTION[kind].pub}/${content.slug}`);
        const banner = page.getByRole("status");
        await expect(banner).toBeVisible();
        // « publication programmée le {date} » : la date annoncée est celle programmée (l'année suffit à ne pas dépendre du fuseau).
        await expect(banner).toContainText(P.scheduled.split("{date}")[0].trim());
        await expect(banner).toContainText(String(new Date(at).getFullYear()));
      } finally {
        await anonymous.context().close();
        await e2eDb().blogArticle.deleteMany({ where: { id: content.id } });
      }
    });

    for (const state of ["draft", "scheduled"] as const) {
      test(`l'aperçu d'un contenu ${state === "draft" ? "en brouillon" : "programmé"} n'est jamais indexé, jamais mis en cache public, sans données structurées, et mène à la modification`, async ({ page }) => {
        await adminPage(page, `preview-meta-${state}-${kind.toLowerCase()}`);
        // Un contenu PROGRAMMÉ a une date de parution (future) : c'est lui qui prouverait des données structurées publiées à tort.
        // Un brouillon n'en a pas, donc n'en produirait de toute façon aucune.
        const content = await createContent(page, kind, state === "draft" ? { mode: "draft" } : { mode: "scheduled", at: futureIso() });
        try {
          const response = await page.request.get(`/fr/${SECTION[kind].pub}/${content.slug}`);
          expect(response.status()).toBe(200);
          const html = await response.text();
          // Jamais indexé : « noindex » dans les balises de la page.
          expect(html).toMatch(/<meta name="robots" content="[^"]*noindex[^"]*"/i);
          expect(html).not.toMatch(/<link rel="canonical"/i); // pas d'adresse canonique : ce contenu n'est pas public
          // Jamais servi à d'autres depuis un cache : la réponse dépend du visiteur, elle ne doit pas être partagée.
          const cacheControl = response.headers()["cache-control"] ?? "";
          expect(cacheControl, "cache-control d'un aperçu").toMatch(/no-store|private|no-cache/);
          expect(cacheControl).not.toMatch(/public|s-maxage/);
          // Aucune donnée structurée : ni article, ni essai, ni fil d'Ariane — rien à faire lire aux moteurs.
          expect(html).not.toContain('"@type":"Article"');
          expect(html).not.toContain('"@type":"Review"');
          expect(html).not.toContain('"@type":"BreadcrumbList"');

          // Le bandeau mène à la modification de CE contenu.
          await page.goto(`/fr/${SECTION[kind].pub}/${content.slug}`);
          await page.getByRole("status").getByRole("link", { name: P.edit }).click();
          await expect(page).toHaveURL(new RegExp(`/fr/admin/${SECTION[kind].admin}/${content.id}/modifier$`));
        } finally {
          await e2eDb().blogArticle.deleteMany({ where: { id: content.id } });
        }
      });
    }

    test("un brouillon reste absent des listes publiques et du plan du site, MÊME pour l'administrateur qui l'aperçoit", async ({ page, request }) => {
      await adminPage(page, `preview-lists-${kind.toLowerCase()}`);
      const content = await createContent(page, kind, { mode: "draft" });
      try {
        await page.goto(`/fr/${SECTION[kind].pub}`);
        await expect(page.getByText(content.title)).toHaveCount(0);
        expect(await (await request.get("/sitemap.xml")).text()).not.toContain(content.slug);
        // L'aperçu, lui, marche : c'est la liste et le plan du site qui n'ont pas changé.
        expect((await page.request.get(`/fr/${SECTION[kind].pub}/${content.slug}`)).status()).toBe(200);
      } finally {
        await e2eDb().blogArticle.deleteMany({ where: { id: content.id } });
      }
    });

    test("l'administration propose « Aperçu » pour un brouillon et un programmé, « Voir » pour un contenu paru ; un contenu paru n'a pas de bandeau", async ({ page }) => {
      await adminPage(page, `preview-list-${kind.toLowerCase()}`);
      const draft = await createContent(page, kind, { mode: "draft" });
      const published = await createContent(page, kind, { mode: "now" });
      try {
        await page.goto(`/fr/admin/${SECTION[kind].admin}`);
        const rowOf = (title: string) => page.locator("div.rounded-lg", { has: page.getByText(title, { exact: true }) });
        const draftRow = rowOf(draft.title);
        await expect(draftRow.getByRole("link", { name: fr.AdminBlog.preview })).toHaveAttribute("href", new RegExp(`/${SECTION[kind].pub}/${draft.slug}$`));
        await expect(draftRow.getByRole("link", { name: fr.AdminBlog.view })).toHaveCount(0);
        const publishedRow = rowOf(published.title);
        await expect(publishedRow.getByRole("link", { name: fr.AdminBlog.view })).toBeVisible();
        await expect(publishedRow.getByRole("link", { name: fr.AdminBlog.preview })).toHaveCount(0);

        // Un contenu PARU n'a pas de bandeau, même pour l'administrateur : c'est la page publique, telle quelle.
        await page.goto(`/fr/${SECTION[kind].pub}/${published.slug}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByRole("status").filter({ hasText: P.label })).toHaveCount(0);
      } finally {
        await e2eDb().blogArticle.deleteMany({ where: { id: { in: [draft.id, published.id] } } });
      }
    });
  });
}

test.describe("passage du brouillon à la publication", () => {
  test("le même contenu passe de « 404 pour le public » à « public », et le bandeau disparaît", async ({ page, browser }) => {
    await adminPage(page, "preview-transition");
    const content = await createContent(page, "GUIDE", { mode: "draft" });
    const anonymous = await viewer(browser, null);
    const url = `/fr/guides/${content.slug}`;
    try {
      expect((await anonymous.request.get(url)).status()).toBe(404);
      await page.goto(url);
      await expect(page.getByRole("status").filter({ hasText: P.label })).toBeVisible();

      await e2eDb().blogArticle.update({ where: { id: content.id }, data: { publishedAt: new Date(Date.now() - 60_000) } }); // publié
      const publicResponse = await anonymous.request.get(url);
      expect(publicResponse.status()).toBe(200);
      const html = await publicResponse.text();
      expect(html).not.toContain("data-article-preview"); // aucun bandeau pour le public
      expect(html).toContain('"@type":"Article"'); // et ses données structurées sont bien là
      expect(html).not.toMatch(/name="robots" content="[^"]*noindex/i); // indexable, comme avant
      await page.goto(url);
      await expect(page.getByRole("status").filter({ hasText: P.label })).toHaveCount(0);
    } finally {
      await anonymous.context().close();
      await e2eDb().blogArticle.deleteMany({ where: { id: content.id } });
    }
  });
});
