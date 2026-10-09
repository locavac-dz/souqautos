import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { compareLocales, flattenMessages, scanTranslationCalls, unusedMessageKeys, type Messages } from "@/lib/i18n-audit";

// Lot 128 — les VRAIS fichiers de messages et le VRAI code source. Ces tests ne jugent pas la qualité de
// l'arabe (seul un locuteur natif le peut : voir `npm run i18n:review`) ; ils empêchent qu'un texte
// manque dans une langue, qu'une variable soit oubliée, qu'un pluriel soit cassé, ou que le code demande
// une clé qui n'existe pas (la page plante ou affiche la clé brute au rendu).
const ROOT = path.resolve(__dirname, "..");
const read = (file: string): Messages => JSON.parse(readFileSync(path.join(ROOT, file), "utf8"));
const fr = flattenMessages(read("messages/fr.json"));
const ar = flattenMessages(read("messages/ar.json"));

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("messages FR / AR", () => {
  const comparison = compareLocales(fr, ar);

  it("has exactly the same keys in both languages", () => {
    expect(comparison.onlyInFirst, "clés seulement en français").toEqual([]);
    expect(comparison.onlyInSecond, "clés seulement en arabe").toEqual([]);
  });

  it("has no empty message", () => {
    expect(comparison.empty).toEqual([]);
  });

  it("has valid message syntax everywhere (braces, plurals with their « other » clause)", () => {
    expect(comparison.syntaxErrors).toEqual([]);
  });

  it("uses the same variables and tags in both languages", () => {
    expect(comparison.argumentMismatches).toEqual([]);
  });

  it("has a substantial catalogue (guards against an accidentally truncated file)", () => {
    expect(Object.keys(fr).length).toBeGreaterThan(1300);
    expect(Object.keys(ar)).toHaveLength(Object.keys(fr).length);
  });
});

// Textes qui ont le droit d'être identiques ou sans lettre arabe : noms de marque, noms de paliers,
// sigles et formats numériques. Toute NOUVELLE entrée identique au français, ou entièrement latine
// en arabe, fait échouer le test : soit c'est une traduction oubliée, soit il faut l'ajouter ici en
// connaissance de cause.
const SAME_IN_BOTH = new Set([
  "Legal.publisherName",
  "Legal.publisherLegalForm",
  "MyListings.formulaPremium",
  "MyListings.formulaPremiumPlus",
  "Search.formulaPremiumBadge",
  "Search.formulaPremiumPlusBadge",
  "Catalogue.modelTitle",
  "TrustScore.scoreValue",
  "TrustScore.pointsEarned",
  "TrustScore.penaltyApplied",
  "Pro.subscriptionTierSTARTER",
  "Pro.subscriptionTierBUSINESS",
  "Pro.subscriptionTierPREMIUM",
  "ProLanding.tierSTARTER",
  "ProLanding.tierBUSINESS",
  "ProLanding.tierPREMIUM",
  "OwnerReview.averageLabel",
]);
const LATIN_ONLY_IN_ARABIC = new Set([...SAME_IN_BOTH, "Pro.subscriptionTierPRO", "ProLanding.tierPRO", "Pro.subscriptionUpgradeBankRib"]);
const ARABIC_LETTER = /[؀-ۿ]/;
const LATIN_WORD = /[A-Za-zÀ-ÿ]{3,}/;

describe("messages arabes — traductions oubliées", () => {
  it("has no message identical to the French one, except brands, tiers and formats", () => {
    const identical = Object.keys(fr).filter((k) => fr[k] === ar[k] && /[A-Za-zÀ-ÿ]{4,}/.test(fr[k]));
    expect(identical.filter((k) => !SAME_IN_BOTH.has(k))).toEqual([]);
  });

  it("has no Arabic message made only of Latin letters, except the same known exceptions", () => {
    const latinOnly = Object.keys(ar).filter((k) => !ARABIC_LETTER.test(ar[k]) && LATIN_WORD.test(ar[k]));
    expect(latinOnly.filter((k) => !LATIN_ONLY_IN_ARABIC.has(k))).toEqual([]);
  });

  it("does not leave French words inside an Arabic sentence", () => {
    const french = /\b(le|la|les|des|une|pour|avec|vous|votre|sur|dans|est|sont|pas|ou|et)\b/i;
    const mixed = Object.keys(ar).filter((k) => ARABIC_LETTER.test(ar[k]) && (ar[k].match(/[A-Za-zÀ-ÿ]+/g) ?? []).some((w) => french.test(w)));
    expect(mixed).toEqual([]);
  });

  it("does not keep the exceptions list longer than needed (a stale entry hides a future mistake)", () => {
    for (const key of SAME_IN_BOTH) expect(fr[key], key).toBe(ar[key]);
    for (const key of LATIN_ONLY_IN_ARABIC) expect(key in ar, key).toBe(true);
  });
});

describe("clés utilisées par le code", () => {
  const keys = new Set(Object.keys(fr));
  const scans = sourceFiles(path.join(ROOT, "src")).map((file) => ({ file: path.relative(ROOT, file).replace(/\\/g, "/"), scan: scanTranslationCalls(readFileSync(file, "utf8"), keys) }));

  it("scans a large part of the code (guards against the scanner silently finding nothing)", () => {
    const checked = scans.reduce((sum, s) => sum + s.scan.checked, 0);
    expect(checked).toBeGreaterThan(1500);
  });

  it("finds every literal key the code asks for, in the message files", () => {
    const missing = scans.flatMap(({ file, scan }) => scan.missing.map((key) => `${key}  ←  ${file}`));
    expect(missing).toEqual([]);
  });

  // Lot 269 (audit E2) — le balayage inverse : une clé que plus aucun écran ne demande est du poids mort (et de
  // l'arabe à relire pour rien). Les familles ci-dessous sont consommées d'une façon que le balayage ne voit pas
  // (clé construite dans une variable avant l'appel) : à justifier une par une, jamais allongée par confort.
  const CONSUMED_INDIRECTLY = [
    /^MarketStats\.badge_/, // t(`badge_${badge}`) dans un composant dont `t` vient d'un Promise.all
    /^Pro\.(logo|banner)(SectionTitle|ChangeAction|RemoveAction|Uploading)$/, // ProBrandingUpload : `${kind}SectionTitle`
    /^BulkImport\.error_/, // BulkImportForm : `error_${r.error}` filtré par KNOWN_ERRORS
    /^ContactEmails\.faq[QA][1-5]$/, // contact-messages.ts : `faqQ${i}` / `faqA${i}` sur FAQ_ITEMS (Lot 273)
  ];

  it("has no orphan message key (one that no screen asks for), except the known indirect families", () => {
    const sources = sourceFiles(path.join(ROOT, "src")).map((f) => readFileSync(f, "utf8"));
    const unused = unusedMessageKeys(fr, sources).filter((key) => !CONSUMED_INDIRECTLY.some((p) => p.test(key)));
    expect(unused).toEqual([]);
    // Et l'inverse : chaque exception doit encore servir à quelque chose.
    for (const pattern of CONSUMED_INDIRECTLY) expect(Object.keys(fr).some((k) => pattern.test(k)), String(pattern)).toBe(true);
  });

  it("finds at least one message for every computed key (`status${x}`)", () => {
    const unmatched = scans.flatMap(({ file, scan }) => scan.dynamic.filter((d) => !d.matched).map((d) => `${d.key}  ←  ${file}`));
    expect(unmatched).toEqual([]);
  });
});
