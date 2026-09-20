import { describe, expect, it } from "vitest";
import { MAX_REQUESTED_PAGE, pageWindow, parseRequestedPage } from "@/lib/pagination";

describe("parseRequestedPage — le numéro de page lu dans l'adresse", () => {
  it("lit un entier positif, avec ou sans espaces, et prend la première valeur d'un paramètre répété", () => {
    expect(parseRequestedPage("3")).toBe(3);
    expect(parseRequestedPage(" 12 ")).toBe(12);
    expect(parseRequestedPage(["4", "9"])).toBe(4);
  });
  it("ignore tout ce qui n'est pas un entier : absent, vide, texte, négatif, décimal, notation scientifique", () => {
    for (const value of [undefined, "", "  ", "abc", "-2", "1.5", "1e3", "3 ; DROP", "0x10", []]) expect(parseRequestedPage(value as string | undefined), JSON.stringify(value)).toBeUndefined();
  });
  it("plafonne une page démesurée : jamais un OFFSET de plusieurs milliards", () => {
    expect(parseRequestedPage("999999999")).toBe(MAX_REQUESTED_PAGE);
    expect(parseRequestedPage("9999999999")).toBeUndefined(); // dix chiffres ou plus : refusé d'emblée
  });
  it("s'associe à pageWindow : hors bornes, on retombe sur une page qui existe", () => {
    expect(pageWindow(45, parseRequestedPage("2"), 20)).toEqual({ page: 2, totalPages: 3, skip: 20 });
    expect(pageWindow(45, parseRequestedPage("99"), 20)).toEqual({ page: 3, totalPages: 3, skip: 40 });
    expect(pageWindow(45, parseRequestedPage("zzz"), 20)).toEqual({ page: 1, totalPages: 3, skip: 0 });
    expect(pageWindow(0, parseRequestedPage("5"), 20)).toEqual({ page: 1, totalPages: 1, skip: 0 });
  });
});
