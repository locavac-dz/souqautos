import { describe, expect, it } from "vitest";
import { containsInsensitive, matchesLike } from "@/lib/like";

describe("matchesLike — le motif de LIKE, en entier", () => {
  it("un texte sans joker doit correspondre en entier, sans tenir compte de la casse", () => {
    expect(matchesLike("Clio", "clio")).toBe(true);
    expect(matchesLike("Clio", "CLIO")).toBe(true);
    expect(matchesLike("Clio", "cli")).toBe(false);
    expect(matchesLike("Clio", "clios")).toBe(false);
    expect(matchesLike("", "")).toBe(true);
    expect(matchesLike("a", "")).toBe(false);
  });

  it("« % » remplace n'importe quelle suite de caractères, même vide", () => {
    expect(matchesLike("Renault Clio", "%clio")).toBe(true);
    expect(matchesLike("Renault Clio", "ren%")).toBe(true);
    expect(matchesLike("Renault Clio", "ren%clio")).toBe(true);
    expect(matchesLike("Renault", "renault%")).toBe(true); // suite vide
    expect(matchesLike("Renault", "%")).toBe(true);
    expect(matchesLike("", "%")).toBe(true);
    expect(matchesLike("Renault", "%x%")).toBe(false);
    expect(matchesLike("abc", "a%%c")).toBe(true); // « %% » vaut « % »
  });

  it("« _ » remplace exactement UN caractère", () => {
    expect(matchesLike("Clio", "c_io")).toBe(true);
    expect(matchesLike("Clio", "c_o")).toBe(false);
    expect(matchesLike("Clio", "____")).toBe(true);
    expect(matchesLike("Clio", "___")).toBe(false);
    expect(matchesLike("", "_")).toBe(false);
  });

  it("« \\ » protège le caractère suivant : « \\% » et « \\_ » sont des caractères ordinaires", () => {
    expect(matchesLike("50%", "50\\%")).toBe(true);
    expect(matchesLike("50x", "50\\%")).toBe(false);
    expect(matchesLike("a_b", "a\\_b")).toBe(true);
    expect(matchesLike("axb", "a\\_b")).toBe(false);
    expect(matchesLike("a\\b", "a\\\\b")).toBe(true); // « \\ » = un « \ »
  });

  it("gère les caractères hors du latin de base par caractère entier : arabe, lettres accentuées, symboles hors du plan de base", () => {
    expect(matchesLike("الجزائر", "الجزائر")).toBe(true);
    expect(matchesLike("الجزائر", "ال%")).toBe(true);
    expect(matchesLike("الجزائر", "_______")).toBe(true); // sept lettres, sept jokers
    expect(matchesLike("Mégane", "m_gane")).toBe(true); // « é » est un seul caractère
    expect(matchesLike("Mégane", "megane")).toBe(false); // aucun pliage des accents
    expect(matchesLike("😀", "_")).toBe(true); // un caractère, même hors du plan de base (comme PostgreSQL)
  });

  it("un « \\ » seul à la fin n'est pas une erreur : il vaut un « \\ » ordinaire", () => {
    expect(matchesLike("a\\", "a\\")).toBe(true);
  });
});

describe("containsInsensitive — l'équivalent de ILIKE '%mot%'", () => {
  it("contient, sans tenir compte de la casse", () => {
    expect(containsInsensitive("Renault", "nau")).toBe(true);
    expect(containsInsensitive("Renault", "NAU")).toBe(true);
    expect(containsInsensitive("Renault", "x")).toBe(false);
    expect(containsInsensitive("Renault", "")).toBe(true);
  });
  it("reproduit les jokers de la recherche d'origine (Prisma ne les protège pas)", () => {
    expect(containsInsensitive("Clio", "c_io")).toBe(true);
    expect(containsInsensitive("Clio", "%")).toBe(true);
    expect(containsInsensitive("Clio", "C%O")).toBe(true);
    expect(containsInsensitive("Clio", "50%")).toBe(false);
    expect(containsInsensitive("Clio", "cl\\")).toBe(false); // « \% » final : un « % » littéral
  });
});

describe("coût borné : aucun motif ne peut figer le serveur", () => {
  it("un motif de 120 caractères plein de « % » sur un nom de 40 lettres se résout en une fraction de milliseconde", () => {
    // Avec une expression régulière, ce motif provoquerait un retour arrière exponentiel.
    const worst = `${"a%".repeat(59)}b`;
    const name = "a".repeat(40);
    const started = performance.now();
    for (let i = 0; i < 200; i++) containsInsensitive(name, worst);
    const perCall = (performance.now() - started) / 200;
    expect(containsInsensitive(name, worst)).toBe(false);
    expect(perCall).toBeLessThan(5);
  });

  it("même chose avec des « _ » et des « % » mêlés, sur un texte qui ne correspond presque jamais", () => {
    const pattern = `${"_%".repeat(50)}z`;
    const started = performance.now();
    expect(containsInsensitive("x".repeat(60), pattern)).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });
});
