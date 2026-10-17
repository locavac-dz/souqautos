import { describe, it, expect } from "vitest";
import { parseCsv, toRecords } from "@/lib/import/csv.js";

describe("parseCsv", () => {
  it("découpe des lignes simples", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("gère une virgule protégée par des guillemets", () => {
    expect(parseCsv('code,adresse\nB1,"Rue A, Alger"')).toEqual([
      ["code", "adresse"],
      ["B1", "Rue A, Alger"],
    ]);
  });

  it("gère un saut de ligne et des guillemets doublés dans un champ", () => {
    expect(parseCsv('x\n"ligne1\nligne2"')).toEqual([["x"], ["ligne1\nligne2"]]);
    expect(parseCsv('x\n"il a dit ""oui"""')).toEqual([["x"], ['il a dit "oui"']]);
  });

  it("gère CRLF et le BOM, et ignore une dernière ligne vide", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("toRecords", () => {
  it("normalise les en-têtes en minuscules et comble les colonnes manquantes", () => {
    const { headers, records } = toRecords("Code,Type,Adresse\nB1,LOGEMENT");
    expect(headers).toEqual(["code", "type", "adresse"]);
    expect(records).toEqual([{ code: "B1", type: "LOGEMENT", adresse: "" }]);
  });
});
