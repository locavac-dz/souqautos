// Tests unitaires du générateur PDF minimal (pur).
import { describe, it, expect } from "vitest";
import { documentPdf } from "@/lib/pdf/simple.js";

describe("documentPdf", () => {
  const pdf = documentPdf({
    titre: "Récépissé REC-ABCD1234",
    sousTitre: "Édité le 2026-10-17",
    lignes: [
      { label: "Statut", valeur: "NOUVELLE" },
      { label: "Description", valeur: "Fuite (robinet) \\ cuisine" },
    ],
    pied: "Document de données.",
  });
  const texte = pdf.toString("latin1");

  it("commence par l'en-tête %PDF et finit par %%EOF", () => {
    expect(texte.startsWith("%PDF-1.4")).toBe(true);
    expect(texte.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("contient une table xref et un trailer cohérents", () => {
    expect(texte).toContain("\nxref\n");
    expect(texte).toContain("trailer");
    expect(texte).toContain("/Root 1 0 R");
    // 6 entrées xref (objet libre 0 + 5 objets).
    expect(texte).toMatch(/xref\n0 6\n/);
  });

  it("échappe les parenthèses et antislash dans le texte", () => {
    // "(robinet)" et "\" doivent être échappés dans le flux de contenu.
    expect(texte).toContain("\\(robinet\\)");
    expect(texte).toContain("Fuite \\(robinet\\) \\\\ cuisine");
  });

  it("intègre le titre et les accents (latin1/WinAnsi)", () => {
    expect(texte).toContain("Récépissé REC-ABCD1234");
    expect(texte).toContain("/Encoding /WinAnsiEncoding");
    // 'é' encodé en latin1 = 0xE9.
    expect(pdf.includes(0xe9)).toBe(true);
  });

  it("offset xref pointe sur le début de la table", () => {
    const m = texte.match(/startxref\n(\d+)\n/);
    expect(m).not.toBeNull();
    const off = Number(m![1]);
    expect(texte.slice(off, off + 4)).toBe("xref");
  });
});
