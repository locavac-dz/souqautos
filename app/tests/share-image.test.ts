import { describe, expect, it } from "vitest";
import {
  SHARE_DETAILS_MAX,
  SHARE_HEADING_MAX,
  buildShareCard,
  formatShareMileage,
  formatSharePrice,
  latinSafe,
  truncateLabel,
  type ShareCardInput,
} from "@/lib/share-image";

const CAR: ShareCardInput = { brandLabel: "Renault", modelLabel: "Clio", year: 2019, mileage: 60000, fuelType: "DIESEL", price: 1_900_000, wilayaNameFr: "Alger" };

describe("latinSafe — la police embarquée ne connaît que le latin", () => {
  it("garde le français : accents, œ, tiret, apostrophe typographique", () => {
    expect(latinSafe("Citroën C4 Cactus")).toBe("Citroën C4 Cactus");
    expect(latinSafe("Aïn Témouchent")).toBe("Aïn Témouchent");
    expect(latinSafe("Œuvre d’art – Coupé")).toBe("Œuvre d’art – Coupé");
    expect(latinSafe("Mercedes-Benz")).toBe("Mercedes-Benz");
  });

  it("retire l'arabe : il s'afficherait en carrés vides", () => {
    expect(latinSafe("رينو كليو")).toBe("");
    expect(latinSafe("Golf سيارة رائعة")).toBe("Golf");
  });

  it("retire les emojis : ImageResponse irait chercher leur dessin sur un service externe", () => {
    expect(latinSafe("Golf 🚗🔥")).toBe("Golf");
    expect(latinSafe("🚗")).toBe("");
    expect(latinSafe("Clio ❤️ 2019")).toBe("Clio 2019");
  });

  it("retire les caractères invisibles et de contrôle (marques de sens de lecture, largeur nulle, retours à la ligne)", () => {
    expect(latinSafe("Clio\u200F\u200E\u200B 2019")).toBe("Clio 2019");
    expect(latinSafe("Clio\u0000\u0007\u001B[31m")).toBe("Clio[31m");
    expect(latinSafe("Clio\n\r\t   Sport")).toBe("Clio Sport");
  });

  it("propriété : quel que soit le texte, seuls des caractères sûrs survivent", () => {
    const allowed = /^[\u0020-\u007E\u00A0-\u00FF\u0152\u0153\u2013\u2014\u2019]*$/;
    // Un balayage de tout le plan multilingue de base, par paquets, plus les emojis hors plan de base.
    for (let start = 0; start < 0x10000; start += 512) {
      const chunk = String.fromCharCode(...Array.from({ length: 512 }, (_, i) => start + i).filter((c) => c < 0xd800 || c > 0xdfff));
      expect(latinSafe(chunk), `bloc U+${start.toString(16)}`).toMatch(allowed);
    }
    expect(latinSafe("😀👨\u200D👩\u200D👧\u200D👦🏳️\u200D🌈")).toMatch(allowed);
  });
});

describe("truncateLabel", () => {
  it("ne touche pas un texte assez court, même pile à la limite", () => {
    expect(truncateLabel("Renault Clio", 28)).toBe("Renault Clio");
    expect(truncateLabel("a".repeat(28), 28)).toBe("a".repeat(28));
  });

  it("coupe à la limite avec trois points, sans jamais dépasser", () => {
    for (const text of ["Mercedes-Benz Classe C Coupé Sport AMG Line Édition", "x".repeat(200), "un deux trois quatre cinq six sept huit neuf dix"]) {
      const out = truncateLabel(text, 28);
      expect(out.length).toBeLessThanOrEqual(28);
      expect(out.endsWith("...")).toBe(true);
    }
  });

  it("préfère couper entre deux mots, mais coupe un mot unique trop long plutôt que de rendre un texte vide", () => {
    expect(truncateLabel("Mercedes-Benz Classe C Coupé Sport", 28)).toBe("Mercedes-Benz Classe C...");
    expect(truncateLabel("x".repeat(200), 28)).toBe("x".repeat(25) + "...");
  });
});

describe("formatSharePrice / formatShareMileage — espaces ordinaires, jamais l'espace fine d'Intl", () => {
  it("groupe les milliers par trois", () => {
    expect(formatSharePrice(0)).toBe("0 DA");
    expect(formatSharePrice(999)).toBe("999 DA");
    expect(formatSharePrice(1000)).toBe("1 000 DA");
    expect(formatSharePrice(1_900_000)).toBe("1 900 000 DA");
    expect(formatSharePrice(12_500_000)).toBe("12 500 000 DA");
    expect(formatShareMileage(60_000)).toBe("60 000 km");
    expect(formatShareMileage(950)).toBe("950 km");
  });

  it("n'emploie que des espaces ordinaires : l'espace fine insécable (U+202F) et l'insécable n'existent pas dans la police", () => {
    for (const text of [formatSharePrice(123_456_789), formatShareMileage(123_456)]) {
      expect(text).not.toMatch(/[\u202F\u00A0]/);
    }
  });

  it("arrondit ce qui n'est pas entier au lieu d'afficher des décimales", () => {
    expect(formatSharePrice(1_899_999.6)).toBe("1 900 000 DA");
  });
});

describe("buildShareCard", () => {
  it("compose la carte d'une annonce ordinaire", () => {
    expect(buildShareCard(CAR)).toEqual({ heading: "Renault Clio", details: "2019 · 60 000 km · Diesel · Alger", price: "1 900 000 DA" });
  });

  it("traduit chaque carburant, et omet un carburant inconnu plutôt que d'afficher un code brut", () => {
    for (const [code, label] of [["ESSENCE", "Essence"], ["DIESEL", "Diesel"], ["GPL", "GPL"], ["HYBRIDE", "Hybride"], ["ELECTRIQUE", "Électrique"]]) {
      expect(buildShareCard({ ...CAR, fuelType: code }).details).toContain(label);
    }
    expect(buildShareCard({ ...CAR, fuelType: "NUCLEAIRE" }).details).toBe("2019 · 60 000 km · Alger");
  });

  it("omet un kilométrage nul (véhicule neuf) au lieu d'afficher « 0 km »", () => {
    expect(buildShareCard({ ...CAR, mileage: 0 }).details).toBe("2019 · Diesel · Alger");
  });

  it("une marque et un modèle saisis en arabe donnent « Souq Auto », jamais un titre vide", () => {
    expect(buildShareCard({ ...CAR, brandLabel: "رينو", modelLabel: "كليو" }).heading).toBe("Souq Auto");
  });

  it("un texte libre mêlant arabe et emojis ne garde que sa partie latine", () => {
    expect(buildShareCard({ ...CAR, brandLabel: "سيارة 🚗", modelLabel: "للبيع 🔥 Golf" }).heading).toBe("Golf");
  });

  it("une wilaya sans partie latine est omise des détails", () => {
    expect(buildShareCard({ ...CAR, wilayaNameFr: "الجزائر" }).details).toBe("2019 · 60 000 km · Diesel");
  });

  it("borne toujours le titre et les détails, quoi que le vendeur ait saisi", () => {
    const card = buildShareCard({ ...CAR, brandLabel: "M".repeat(80), modelLabel: "Classe ".repeat(30), wilayaNameFr: "W".repeat(200) });
    expect(card.heading.length).toBeLessThanOrEqual(SHARE_HEADING_MAX);
    expect(card.details.length).toBeLessThanOrEqual(SHARE_DETAILS_MAX);
  });

  it("la carte est la même dans toutes les langues : aucune donnée n'y dépend de la langue de la page", () => {
    // Le nom de wilaya est toujours le français (paramètre `wilayaNameFr`) : l'appelant n'a même pas de moyen de passer l'arabe.
    expect(Object.keys(CAR)).toContain("wilayaNameFr");
    expect(Object.keys(CAR)).not.toContain("wilayaNameAr");
  });
});
