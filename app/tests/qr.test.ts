import qrcode from "qrcode-generator";
import { describe, expect, it } from "vitest";
import { QR_QUIET_ZONE, drawingToMatrix, qrDrawing } from "@/lib/qr";
import { otpauthUri } from "@/lib/totp";

const SAMPLE = otpauthUri({ issuer: "Souq Auto", account: "amina@example.dz", secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" });

describe("qrDrawing", () => {
  const drawing = qrDrawing(SAMPLE);
  const matrix = drawingToMatrix(drawing);

  it("reproduit EXACTEMENT la matrice du code, module par module", () => {
    const reference = qrcode(0, "M");
    reference.addData(SAMPLE);
    reference.make();
    const n = reference.getModuleCount();
    expect(drawing.size).toBe(n + 2 * QR_QUIET_ZONE);
    for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) expect(matrix[row + QR_QUIET_ZONE][col + QR_QUIET_ZONE], `${row},${col}`).toBe(reference.isDark(row, col));
  });

  it("laisse la zone de silence de 4 modules entièrement claire", () => {
    const q = QR_QUIET_ZONE;
    for (let i = 0; i < drawing.size; i++) {
      for (let k = 0; k < q; k++) {
        expect(matrix[k][i]).toBe(false);
        expect(matrix[drawing.size - 1 - k][i]).toBe(false);
        expect(matrix[i][k]).toBe(false);
        expect(matrix[i][drawing.size - 1 - k]).toBe(false);
      }
    }
  });

  it("porte les trois motifs de repérage aux coins (7 × 7 : anneau, anneau clair, carré central)", () => {
    const finder = ["1111111", "1000001", "1011101", "1011101", "1011101", "1000001", "1111111"];
    const q = QR_QUIET_ZONE;
    const at = (top: number, left: number) => finder.map((_, r) => finder[0].split("").map((__, c) => (matrix[top + r][left + c] ? "1" : "0")).join(""));
    const last = drawing.size - q - 7;
    expect(at(q, q)).toEqual(finder); // haut gauche
    expect(at(q, last)).toEqual(finder); // haut droite
    expect(at(last, q)).toEqual(finder); // bas gauche
  });

  it("ne produit que des tracés SVG simples (aucun balisage, aucun caractère injectable)", () => {
    expect(drawing.path).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/);
    expect(qrDrawing("<script>alert(1)</script>").path).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/);
  });

  it("choisit seul la taille : un texte plus long donne un code plus grand", () => {
    expect(qrDrawing("a").size).toBeLessThan(qrDrawing(SAMPLE).size);
    expect(qrDrawing(SAMPLE).size).toBeLessThan(qrDrawing(SAMPLE.repeat(3)).size);
  });
});
