import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GENERAL_BUYING_GUIDE as guide } from "@/content/general-buying-guide";
import { MAX_CHECKLIST_ITEMS, MAX_CHECKLIST_ITEM_LENGTH } from "@/lib/buying-guide";
import { splitLines } from "@/lib/road-test";
import { blogArticleSchema } from "@/lib/validation/blog";
import fr from "../messages/fr.json";
import ar from "../messages/ar.json";

// Lot 144 — le guide d'achat GÉNÉRAL livré avec le site (src/content/general-buying-guide.ts). C'est un texte, mais un texte qui parle
// du site et de ses fonctions, et qui existe en deux langues : ces tests gardent ce qui peut se garder mécaniquement — il passe les
// règles de l'administration, les deux versions ont la même structure, il n'annonce que des libellés qui existent vraiment, ses liens
// mènent quelque part, et il ne contient rien que le rendu écarterait. Ils ne jugent PAS la justesse des conseils : c'est une relecture
// humaine (démarches administratives, arabe), dite en tête du fichier et dans le journal.

const asArticle = { kind: "GUIDE", titleFr: guide.titleFr, titleAr: guide.titleAr, excerptFr: guide.excerptFr, excerptAr: guide.excerptAr, contentFr: guide.contentFr, contentAr: guide.contentAr, publication: { mode: "draft" }, guide: { checklistFr: guide.checklistFr, checklistAr: guide.checklistAr, adviceFr: guide.adviceFr, adviceAr: guide.adviceAr } };

const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;

describe("le guide général respecte les règles de l'administration", () => {
  it("passe le schéma d'un guide d'achat, SANS modèle, en brouillon", () => {
    const parsed = blogArticleSchema.safeParse(asArticle);
    expect(parsed.success, JSON.stringify(parsed.success ? "" : parsed.error.issues)).toBe(true);
    if (parsed.success) {
      expect(parsed.data.guide?.modelId).toBeUndefined(); // un guide général
      expect(parsed.data.publication).toEqual({ mode: "draft" }); // et jamais publié d'office
    }
  });

  it("la liste à vérifier tient dans les bornes, dans les deux langues, avec le même nombre de points", () => {
    const frItems = splitLines(guide.checklistFr);
    const arItems = splitLines(guide.checklistAr);
    expect(frItems.length).toBeGreaterThanOrEqual(8); // une vraie liste, pas un alibi
    expect(frItems.length).toBeLessThanOrEqual(MAX_CHECKLIST_ITEMS);
    expect(arItems).toHaveLength(frItems.length);
    for (const item of [...frItems, ...arItems]) expect(item.length).toBeLessThanOrEqual(MAX_CHECKLIST_ITEM_LENGTH);
  });
});

describe("les deux versions ont la même structure (jamais un guide à moitié traduit)", () => {
  it("mêmes sections, sous-sections, listes, avertissement et liens", () => {
    for (const [label, pattern] of [["sections (##)", /^## /gm], ["sous-sections (###)", /^### /gm], ["puces", /^- /gm], ["avertissement", /^> /gm], ["liens internes", /\]\(\//g]] as const) {
      const frCount = count(guide.contentFr, pattern);
      expect(frCount, `${label} en français`).toBeGreaterThan(0);
      expect(count(guide.contentAr, pattern), label).toBe(frCount);
    }
  });

  it("les sections sont numérotées de la même façon, dans le même ordre", () => {
    const numbers = (text: string) => [...text.matchAll(/^## (\d+)\./gm)].map((m) => Number(m[1]));
    expect(numbers(guide.contentFr)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(numbers(guide.contentAr)).toEqual(numbers(guide.contentFr));
  });

  it("chaque section a un contenu de taille comparable dans les deux langues (pas une section vide d'un côté)", () => {
    const sections = (text: string) => text.split(/^## /m).slice(1);
    const frSections = sections(guide.contentFr);
    const arSections = sections(guide.contentAr);
    expect(arSections).toHaveLength(frSections.length);
    frSections.forEach((section, index) => {
      const ratio = arSections[index].length / section.length;
      expect(ratio, `section ${index + 1}`).toBeGreaterThan(0.4);
      expect(ratio, `section ${index + 1}`).toBeLessThan(2.5);
    });
  });
});

describe("ce que le texte annonce existe vraiment sur le site", () => {
  // Chaque libellé cité entre guillemets dans le texte doit être EXACTEMENT celui de l'interface : si un libellé change, le guide ne doit
  // pas continuer à décrire un bouton qui n'existe plus.
  const labels: { in: "Fr" | "Ar"; text: string; source: string }[] = [
    { in: "Fr", text: fr.SellerTrust.identityVerified, source: "SellerTrust.identityVerified" },
    { in: "Fr", text: fr.PriceBadge.tresBonneAffaire, source: "PriceBadge.tresBonneAffaire" },
    { in: "Fr", text: fr.Report.reportListing, source: "Report.reportListing" },
    { in: "Fr", text: fr.Estimate.title, source: "Estimate.title" },
    { in: "Ar", text: ar.SellerTrust.identityVerified, source: "SellerTrust.identityVerified" },
    { in: "Ar", text: ar.PriceBadge.tresBonneAffaire, source: "PriceBadge.tresBonneAffaire" },
    { in: "Ar", text: ar.Report.reportListing, source: "Report.reportListing" },
    { in: "Ar", text: ar.Estimate.title, source: "Estimate.title" },
  ];
  for (const label of labels) {
    it(`cite « ${label.text} » (${label.in === "Fr" ? "français" : "arabe"}) tel qu'il s'affiche : ${label.source}`, () => {
      expect(label.in === "Fr" ? guide.contentFr : guide.contentAr).toContain(label.text);
    });
  }

  it("cite le début du badge de réactivité, celui que l'interface affiche", () => {
    expect(fr.SellerTrust.cardUnder2h.startsWith("Répond en moins de")).toBe(true);
    expect(guide.contentFr).toContain("« Répond en moins de… »");
    expect(ar.SellerTrust.cardUnder2h.startsWith("يرد في أقل من")).toBe(true);
    expect(guide.contentAr).toContain("«يرد في أقل من…»");
  });

  it("ses liens internes mènent à des pages qui existent, dans la bonne langue", () => {
    const routes = [...guide.contentFr.matchAll(/\]\((\/fr\/[^)]+)\)/g)].map((m) => m[1]);
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const segment = route.replace(/^\/fr\//, "");
      expect(existsSync(path.join(process.cwd(), "src", "app", "[locale]", segment, "page.tsx")), `page de ${route}`).toBe(true);
      expect(guide.contentAr, `même lien en arabe : ${route}`).toContain(`(/ar/${segment})`);
    }
    expect(guide.contentFr).not.toContain("(/ar/"); // pas de lien arabe dans la version française, et inversement
    expect(guide.contentAr).not.toContain("(/fr/");
  });
});

describe("ce que le rendu écarterait n'y figure pas", () => {
  const bodies = [["français", guide.contentFr], ["arabe", guide.contentAr]] as const;
  for (const [label, body] of bodies) {
    it(`(${label}) ni titre de niveau 1, ni image, ni HTML brut, ni lien externe`, () => {
      expect(count(body, /^# /gm)).toBe(0); // la page a déjà son <h1> : le titre du guide
      expect(body).not.toMatch(/!\[/); // les images sont refusées (la seule image d'un guide est sa couverture)
      expect(body).not.toMatch(/<\/?[a-z][^>]*>/i); // le HTML brut est retiré au rendu
      expect(body).not.toMatch(/https?:\/\//i); // aucun lien externe : rien qui puisse vieillir ou détourner
    });
  }

  it("aucun texte de remplissage oublié", () => {
    for (const [, body] of bodies) expect(body).not.toMatch(/lorem ipsum|TODO|À COMPLÉTER|XXX|à définir/i);
  });
});

describe("prudence sur ce que le texte ne peut pas garantir", () => {
  it("porte, en tête, l'avertissement : conseils généraux, démarches à vérifier auprès de l'administration", () => {
    const firstQuote = (text: string) => text.split("\n").find((line) => line.startsWith("> ")) ?? "";
    expect(firstQuote(guide.contentFr)).toContain("administration compétente");
    expect(firstQuote(guide.contentFr)).toMatch(/avis juridique/);
    expect(firstQuote(guide.contentAr)).toContain("الإدارة المختصة");
    expect(firstQuote(guide.contentAr)).toContain("استشارة قانونية");
    // Et il est placé AVANT la première section : le lecteur le voit avant de lire un seul conseil.
    expect(guide.contentFr.indexOf("> ")).toBeLessThan(guide.contentFr.indexOf("## 1."));
    expect(guide.contentAr.indexOf("> ")).toBeLessThan(guide.contentAr.indexOf("## 1."));
  });

  it("ne cite aucun montant, taux, délai chiffré ni nom de formulaire administratif : ce serait une règle que le texte ne peut pas garantir", () => {
    for (const [label, body] of [["français", guide.contentFr], ["arabe", guide.contentAr]] as const) {
      expect(body, `${label} : montant`).not.toMatch(/\d[\d\s.,]*\s?(DA|DZD|dinars?|دج|دينار)/i);
      expect(body, `${label} : pourcentage`).not.toMatch(/\d\s?%/);
      expect(body, `${label} : délai légal chiffré`).not.toMatch(/\b\d+\s?(jours?|mois|ans)\b|\d+\s?(يومًا|أيام|شهر|أشهر|سنة|سنوات)/i);
      expect(body, `${label} : article de loi`).not.toMatch(/article\s+\d+|loi\s+n°|المادة\s+\d+|قانون\s+رقم/i);
    }
  });

  it("le seul chiffre annoncé est la durée d'essai conseillée (20 à 30 minutes), qui est un conseil et non une règle", () => {
    expect(guide.contentFr).toMatch(/20 à 30 minutes/);
    expect(guide.contentAr).toMatch(/20 إلى 30 دقيقة/);
  });
});
