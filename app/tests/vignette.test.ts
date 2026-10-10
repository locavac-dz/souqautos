import { describe, expect, it } from "vitest";
import { computeVignetteDzd, vehicleAgeYears } from "@/lib/vignette";

describe("computeVignetteDzd", () => {
  it("applique le barème ≤ 6 CV selon l'âge", () => {
    expect(computeVignetteDzd({ fiscalPower: 6, fuelType: "ESSENCE", vehicleAgeYears: 1 })).toBe(2000);
    expect(computeVignetteDzd({ fiscalPower: 6, fuelType: "ESSENCE", vehicleAgeYears: 3 })).toBe(1500);
    expect(computeVignetteDzd({ fiscalPower: 6, fuelType: "ESSENCE", vehicleAgeYears: 6 })).toBe(1000);
    expect(computeVignetteDzd({ fiscalPower: 6, fuelType: "ESSENCE", vehicleAgeYears: 10 })).toBe(500);
    expect(computeVignetteDzd({ fiscalPower: 6, fuelType: "ESSENCE", vehicleAgeYears: 25 })).toBe(500);
  });

  it("applique le barème 7-9 CV", () => {
    expect(computeVignetteDzd({ fiscalPower: 7, fuelType: "DIESEL", vehicleAgeYears: 1 })).toBe(4000);
    expect(computeVignetteDzd({ fiscalPower: 9, fuelType: "DIESEL", vehicleAgeYears: 8 })).toBe(2000);
  });

  it("applique le barème 10 CV et plus", () => {
    expect(computeVignetteDzd({ fiscalPower: 10, fuelType: "DIESEL", vehicleAgeYears: 1 })).toBe(25000);
    expect(computeVignetteDzd({ fiscalPower: 16, fuelType: "DIESEL", vehicleAgeYears: 15 })).toBe(10000);
  });

  it("exonère l'électrique et l'hybride, quelle que soit la puissance", () => {
    expect(computeVignetteDzd({ fiscalPower: 12, fuelType: "ELECTRIQUE", vehicleAgeYears: 1 })).toBe(0);
    expect(computeVignetteDzd({ fiscalPower: 12, fuelType: "HYBRIDE", vehicleAgeYears: 1 })).toBe(0);
  });

  it("ne dispense plus le GPL (loi de finances 2026)", () => {
    expect(computeVignetteDzd({ fiscalPower: 6, fuelType: "GPL", vehicleAgeYears: 1 })).toBe(2000);
  });

  it("traite une motorisation inconnue comme non exonérée", () => {
    expect(computeVignetteDzd({ fiscalPower: 6, fuelType: null, vehicleAgeYears: 1 })).toBe(2000);
  });
});

describe("vehicleAgeYears", () => {
  it("soustrait l'année d'immatriculation à l'année courante", () => {
    expect(vehicleAgeYears(2020, new Date("2026-10-10"))).toBe(6);
  });

  it("ne descend jamais sous zéro pour une année future", () => {
    expect(vehicleAgeYears(2030, new Date("2026-10-10"))).toBe(0);
  });
});
