// Tests unitaires i18n : résolution de locale, direction, fusion de repli,
// et validité du fichier de messages arabe.
import { describe, it, expect } from "vitest";
import { resoudreLocale, direction, fusionner, LOCALES, DEFAULT_LOCALE } from "@/i18n/locales.js";
import fr from "../messages/fr.json";
import ar from "../messages/ar.json";

describe("resoudreLocale", () => {
  it("accepte les locales supportées", () => {
    expect(resoudreLocale("fr")).toBe("fr");
    expect(resoudreLocale("ar")).toBe("ar");
  });
  it("retombe sur la locale par défaut pour une valeur inconnue/absente", () => {
    expect(resoudreLocale("en")).toBe(DEFAULT_LOCALE);
    expect(resoudreLocale(undefined)).toBe("fr");
    expect(resoudreLocale(null)).toBe("fr");
    expect(resoudreLocale("")).toBe("fr");
  });
  it("LOCALES contient fr et ar", () => {
    expect([...LOCALES]).toEqual(["fr", "ar"]);
  });
});

describe("direction", () => {
  it("rtl pour ar, ltr pour fr", () => {
    expect(direction("ar")).toBe("rtl");
    expect(direction("fr")).toBe("ltr");
  });
});

describe("fusionner (repli FR)", () => {
  it("surcouche prioritaire, base conservée pour les clés absentes", () => {
    const base = { a: "fr-a", b: { c: "fr-c", d: "fr-d" } };
    const sur = { b: { c: "ar-c" }, e: "ar-e" };
    const out = fusionner(base, sur as never);
    expect(out).toEqual({ a: "fr-a", b: { c: "ar-c", d: "fr-d" }, e: "ar-e" });
  });
  it("ne mute pas les arguments", () => {
    const base = { x: "1" };
    const sur = { x: "2" };
    fusionner(base, sur);
    expect(base.x).toBe("1");
  });
});

describe("messages arabes", () => {
  it("toutes les clés AR existent dans FR (pas de clé orpheline)", () => {
    const feuilles = (o: Record<string, unknown>, prefix = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === "object"
          ? feuilles(v as Record<string, unknown>, `${prefix}${k}.`)
          : [`${prefix}${k}`],
      );
    const clesFr = new Set(feuilles(fr as Record<string, unknown>));
    for (const c of feuilles(ar as Record<string, unknown>)) {
      expect(clesFr.has(c), `clé AR absente de FR: ${c}`).toBe(true);
    }
  });
  it("parité complète FR↔AR : chaque clé FR est traduite en AR", () => {
    const feuilles = (o: Record<string, unknown>, prefix = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === "object"
          ? feuilles(v as Record<string, unknown>, `${prefix}${k}.`)
          : [`${prefix}${k}`],
      );
    const clesAr = new Set(feuilles(ar as Record<string, unknown>));
    const manquantes = feuilles(fr as Record<string, unknown>).filter((c) => !clesAr.has(c));
    expect(manquantes, `clés FR sans traduction AR: ${manquantes.join(", ")}`).toEqual([]);
  });

  it("la fusion AR sur FR couvre 100% des clés FR (repli garanti)", () => {
    const merged = fusionner(fr as never, ar as never);
    // Même nombre de feuilles que FR (aucune clé perdue).
    const compter = (o: Record<string, unknown>): number =>
      Object.values(o).reduce<number>(
        (n, v) => n + (v && typeof v === "object" ? compter(v as Record<string, unknown>) : 1),
        0,
      );
    expect(compter(merged as Record<string, unknown>)).toBe(compter(fr as Record<string, unknown>));
  });
});
