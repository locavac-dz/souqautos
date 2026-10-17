// Tests unitaires du helper de libellés d'enum (pur) + cohérence des messages.
import { describe, it, expect } from "vitest";
import { libelleEnum } from "@/i18n/enums.js";
import fr from "../messages/fr.json";
import ar from "../messages/ar.json";

const dict = {
  statutReclamation: { NOUVELLE: "Nouvelle", RESOLUE: "Résolue" },
};

describe("libelleEnum", () => {
  it("renvoie le libellé traduit s'il existe", () => {
    expect(libelleEnum(dict, "statutReclamation", "NOUVELLE")).toBe("Nouvelle");
  });
  it("repli sur la valeur brute pour une valeur inconnue", () => {
    expect(libelleEnum(dict, "statutReclamation", "INCONNU")).toBe("INCONNU");
  });
  it("repli si le groupe ou le dictionnaire est absent", () => {
    expect(libelleEnum(dict, "statutMarche", "NOTIFIE")).toBe("NOTIFIE");
    expect(libelleEnum(undefined, "statutReclamation", "NOUVELLE")).toBe("NOUVELLE");
  });
  it("affiche un tiret pour une valeur nulle/vide", () => {
    expect(libelleEnum(dict, "affectationType", null)).toBe("—");
    expect(libelleEnum(dict, "affectationType", undefined)).toBe("—");
    expect(libelleEnum(dict, "affectationType", "")).toBe("—");
  });
});

describe("cohérence des dictionnaires d'enum FR/AR", () => {
  const enumsFr = (fr as { enums: Record<string, Record<string, string>> }).enums;
  const enumsAr = (ar as { enums: Record<string, Record<string, string>> }).enums;

  it("mêmes groupes et mêmes valeurs en FR et AR", () => {
    expect(Object.keys(enumsAr).sort()).toEqual(Object.keys(enumsFr).sort());
    for (const g of Object.keys(enumsFr)) {
      expect(Object.keys(enumsAr[g]!).sort(), `groupe ${g}`).toEqual(Object.keys(enumsFr[g]!).sort());
    }
  });
});
