import { describe, expect, it } from "vitest";
import { resolveSource } from "@/lib/blog-source";
import { blogArticleSchema } from "@/lib/validation/blog";
import { buildArticleJsonLd } from "@/lib/structured-data";

describe("resolveSource", () => {
  it("treats an empty source as no source", () => {
    expect(resolveSource({})).toEqual({ ok: true, sourceName: null, sourceUrl: null });
    expect(resolveSource({ sourceName: "  ", sourceUrl: "" })).toEqual({ ok: true, sourceName: null, sourceUrl: null });
    expect(resolveSource({ sourceName: null, sourceUrl: null })).toEqual({ ok: true, sourceName: null, sourceUrl: null });
  });

  it("accepts a name alone", () => {
    expect(resolveSource({ sourceName: " Dossier de presse Renault Algérie " })).toEqual({
      ok: true,
      sourceName: "Dossier de presse Renault Algérie",
      sourceUrl: null,
    });
  });

  it("accepts a name with an https link and stores the link in its normalised form", () => {
    expect(
      resolveSource({ sourceName: "Dossier de presse", sourceUrl: "https://media.constructeur.example/presse/clio/?utm_source=mail#haut" })
    ).toEqual({ ok: true, sourceName: "Dossier de presse", sourceUrl: "https://media.constructeur.example/presse/clio" });
  });

  it("refuses a link without a name, since the reader would not know what it opens", () => {
    expect(resolveSource({ sourceUrl: "https://media.constructeur.example/presse" })).toEqual({
      ok: false,
      error: "source_name_required",
    });
  });

  it("refuses a name that is too short or too long", () => {
    expect(resolveSource({ sourceName: "A" })).toEqual({ ok: false, error: "source_name_length" });
    expect(resolveSource({ sourceName: "x".repeat(121) })).toEqual({ ok: false, error: "source_name_length" });
  });

  it("refuses an unsafe link", () => {
    for (const sourceUrl of ["javascript:alert(1)", "http://media.example.org/x", "https://user@media.example.org/x", "https://127.0.0.1/x"]) {
      expect(resolveSource({ sourceName: "Source", sourceUrl })).toEqual({ ok: false, error: "source_url_invalid" });
    }
  });
});

describe("blogArticleSchema — source", () => {
  const text = (n: number) => "x".repeat(n);
  const article = {
    titleFr: "Titre en français",
    titleAr: "عنوان بالعربية طويل",
    excerptFr: text(30),
    excerptAr: text(30),
    contentFr: text(120),
    contentAr: text(120),
  };
  const roadTest = {
    rating: 3.5,
    prosFr: "Confort",
    prosAr: "راحة",
    consFr: "Coffre",
    consAr: "صندوق",
    verdictFr: "Une compacte confortable et bien équipée.",
    verdictAr: "سيارة مريحة ومجهزة جيدا للغاية.",
  };

  it("accepts a magazine article with a source, or without", () => {
    expect(blogArticleSchema.safeParse({ ...article, sourceName: "Dossier de presse", sourceUrl: "https://media.example.org/x" }).success).toBe(true);
    expect(blogArticleSchema.safeParse(article).success).toBe(true);
    expect(blogArticleSchema.safeParse({ ...article, sourceName: null, sourceUrl: null }).success).toBe(true);
  });

  it("refuses a source on an essai, which is an original test by the editors", () => {
    expect(blogArticleSchema.safeParse({ ...article, kind: "ESSAI", roadTest, sourceName: "Dossier de presse" }).success).toBe(false);
    expect(blogArticleSchema.safeParse({ ...article, kind: "ESSAI", roadTest, sourceName: null, sourceUrl: null }).success).toBe(true);
  });
});

describe("buildArticleJsonLd — isBasedOn", () => {
  const base = {
    title: "Titre",
    description: "Description",
    url: "https://souq.example/fr/mag/x",
    datePublished: "2026-09-19T10:00:00.000Z",
    dateModified: "2026-09-19T10:00:00.000Z",
    authorName: "Souq Auto",
  };

  it("cites the source document when there is a link", () => {
    expect(buildArticleJsonLd({ ...base, isBasedOn: "https://media.example.org/presse" }).isBasedOn).toBe("https://media.example.org/presse");
  });

  it("adds nothing when there is no link", () => {
    expect("isBasedOn" in buildArticleJsonLd(base)).toBe(false);
  });
});
