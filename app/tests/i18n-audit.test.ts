import { describe, expect, it } from "vitest";
import { compareLocales, flattenMessages, messageArguments, messageSyntaxError, scanTranslationCalls, termUsage } from "@/lib/i18n-audit";

describe("flattenMessages", () => {
  it("turns nested namespaces into dotted keys", () => {
    expect(flattenMessages({ Nav: { home: "Accueil", deep: { x: "y" } }, Footer: { a: "b" } })).toEqual({ "Nav.home": "Accueil", "Nav.deep.x": "y", "Footer.a": "b" });
  });
});

describe("messageArguments", () => {
  it("lists simple variables, sorted", () => {
    expect(messageArguments("Bonjour {name}, vous avez {count} messages")).toEqual(["count", "name"]);
    expect(messageArguments("Aucune variable")).toEqual([]);
  });

  it("sees variables inside plural and select branches, not only the outer argument", () => {
    expect(messageArguments("{count, plural, one {{name} a # message} other {{name} a # messages}}")).toEqual(["count", "name"]);
    expect(messageArguments("{gender, select, male {Il} female {Elle} other {{who}}}")).toEqual(["gender", "who"]);
  });

  it("sees rich-text tags", () => {
    expect(messageArguments("Lisez <b>ceci</b> dans {place}")).toEqual(["<b>", "place"]);
  });

  it("gives the same arguments whatever the language of the surrounding text", () => {
    expect(messageArguments("{count, plural, =0 {اليوم} one {قبل # يوم} other {قبل # أيام}}")).toEqual(["count"]);
  });

  it("returns null for a broken message", () => {
    expect(messageArguments("Bonjour {name")).toBeNull();
    expect(messageArguments("{n, plural, one {x}")).toBeNull();
  });
});

describe("messageSyntaxError", () => {
  it("accepts valid messages, including a quote as in « aujourd'hui »", () => {
    expect(messageSyntaxError("Voir {count} annonces")).toBeNull();
    expect(messageSyntaxError("{days, plural, =0 {aujourd'hui} other {il y a # jours}}")).toBeNull();
  });

  it("rejects an unclosed brace and a plural without its « other » clause", () => {
    expect(messageSyntaxError("Bonjour {name")).toMatch(/.+/);
    expect(messageSyntaxError("{n, plural, one {x}")).toMatch(/OTHER|other|EXPECT/i);
  });
});

describe("compareLocales", () => {
  const fr = { "A.one": "Un {x}", "A.two": "Deux", "A.plural": "{n, plural, one {# jour} other {# jours}}" };

  it("finds nothing to report for two consistent languages", () => {
    const ar = { "A.one": "واحد {x}", "A.two": "اثنان", "A.plural": "{n, plural, one {# يوم} other {# أيام}}" };
    expect(compareLocales(fr, ar)).toEqual({ onlyInFirst: [], onlyInSecond: [], argumentMismatches: [], syntaxErrors: [], empty: [] });
  });

  it("reports a key present in one language only, on either side", () => {
    const result = compareLocales(fr, { "A.one": "واحد {x}", "A.two": "اثنان", "A.extra": "زائد" });
    expect(result.onlyInFirst).toEqual(["A.plural"]);
    expect(result.onlyInSecond).toEqual(["A.extra"]);
  });

  it("reports a forgotten or renamed variable: it would show « undefined » or crash the page", () => {
    const result = compareLocales(fr, { "A.one": "واحد", "A.two": "اثنان", "A.plural": "{count, plural, one {#} other {#}}" });
    expect(result.argumentMismatches).toEqual([
      { key: "A.one", first: ["x"], second: [] },
      { key: "A.plural", first: ["n"], second: ["count"] },
    ]);
  });

  it("reports empty messages and syntax errors with the language they are in", () => {
    const result = compareLocales({ ...fr, "A.two": "" }, { "A.one": "واحد {x}", "A.two": "اثنان {", "A.plural": "{n, plural, one {#} other {#}}" });
    expect(result.empty).toEqual([{ locale: "first", key: "A.two" }]);
    expect(result.syntaxErrors.map((e) => `${e.locale}:${e.key}`)).toEqual(["second:A.two"]);
  });
});

describe("scanTranslationCalls", () => {
  const keys = new Set(["Nav.home", "Nav.search", "Listing.title", "Listing.statusVENDUE", "Listing.statusEXPIREE"]);

  it("checks calls on variables declared by useTranslations and getTranslations", () => {
    const source = `
      const t = useTranslations("Nav");
      const tListing = await getTranslations("Listing");
      const a = t("home");
      const b = tListing("title");
      const c = t("search");
    `;
    expect(scanTranslationCalls(source, keys)).toEqual({ checked: 3, missing: [], dynamic: [] });
  });

  it("reports a key that does not exist, with its namespace", () => {
    const source = `const t = useTranslations("Nav"); t("home"); t("cle-oubliee");`;
    expect(scanTranslationCalls(source, keys).missing).toEqual(["Nav.cle-oubliee"]);
  });

  it("understands getTranslations({ locale, namespace })", () => {
    const source = `const t = await getTranslations({ locale, namespace: "Nav" }); t("home"); t("absente");`;
    expect(scanTranslationCalls(source, keys)).toMatchObject({ checked: 2, missing: ["Nav.absente"] });
  });

  it("checks t.rich calls too, and ignores calls on unrelated functions with the same shape", () => {
    const source = `const t = useTranslations("Nav"); t.rich("home", {}); fmt("home"); other.t("home");`;
    expect(scanTranslationCalls(source, keys)).toMatchObject({ checked: 2, missing: [] });
  });

  it("checks a computed key by pattern: at least one real key must match", () => {
    const source = "const t = useTranslations(\"Listing\"); t(`status${row.status}`); t(`inexistant${x}`);";
    expect(scanTranslationCalls(source, keys).dynamic).toEqual([
      { key: "Listing.status${row.status}", matched: true },
      { key: "Listing.inexistant${x}", matched: false },
    ]);
  });

  it("keeps two variables of different namespaces apart", () => {
    const source = `const t = useTranslations("Nav"); const tl = useTranslations("Listing"); t("title"); tl("home");`;
    expect(scanTranslationCalls(source, keys).missing.sort()).toEqual(["Listing.home", "Nav.title"]);
  });
});

describe("termUsage", () => {
  it("counts in how many messages each Arabic variant of a concept appears", () => {
    const usage = termUsage({ "A.1": "سعر السيارة", "A.2": "السعر النهائي", "A.3": "ثمن الشراء", "A.4": "إعلان جديد" });
    const price = usage.find((u) => u.concept === "prix")!;
    expect(price.counts).toEqual([
      { variant: "سعر", count: 2 },
      { variant: "ثمن", count: 1 },
    ]);
    expect(usage.find((u) => u.concept === "annonce")!.counts[0]).toEqual({ variant: "إعلان", count: 1 });
  });
});
