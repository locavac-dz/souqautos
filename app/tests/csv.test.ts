import { describe, expect, it } from "vitest";
import { parseCsv, csvRowsToRecords, stringifyCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses simple comma-separated rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    expect(parseCsv('a,b\n"un, deux",3')).toEqual([
      ["a", "b"],
      ["un, deux", "3"],
    ]);
  });

  it("handles doubled quotes as an escaped quote", () => {
    expect(parseCsv('a\n"il dit ""bonjour"""')).toEqual([["a"], ['il dit "bonjour"']]);
  });

  it("handles quoted fields containing newlines", () => {
    expect(parseCsv('a\n"ligne 1\nligne 2"')).toEqual([["a"], ["ligne 1\nligne 2"]]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("skips a UTF-8 BOM at the start of the file", () => {
    expect(parseCsv("﻿a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("skips blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("csvRowsToRecords", () => {
  it("maps rows to objects keyed by the header row", () => {
    expect(csvRowsToRecords([["nom", "age"], ["Amine", "30"]])).toEqual([{ nom: "Amine", age: "30" }]);
  });

  it("defaults a missing trailing column to an empty string", () => {
    expect(csvRowsToRecords([["nom", "age"], ["Amine"]])).toEqual([{ nom: "Amine", age: "" }]);
  });

  it("returns an empty array when there is only a header or nothing", () => {
    expect(csvRowsToRecords([])).toEqual([]);
    expect(csvRowsToRecords([["nom", "age"]])).toEqual([]);
  });
});

describe("stringifyCsv", () => {
  it("joins simple rows with commas and CRLF", () => {
    expect(
      stringifyCsv([
        ["a", "b", "c"],
        ["1", "2", "3"],
      ])
    ).toBe("a,b,c\r\n1,2,3");
  });

  it("quotes a field containing a comma", () => {
    expect(stringifyCsv([["un, deux", "3"]])).toBe('"un, deux",3');
  });

  it("quotes and doubles an embedded quote", () => {
    expect(stringifyCsv([['il dit "bonjour"']])).toBe('"il dit ""bonjour"""');
  });

  it("quotes a field containing a newline", () => {
    expect(stringifyCsv([["ligne 1\nligne 2"]])).toBe('"ligne 1\nligne 2"');
  });

  it("round-trips through parseCsv for a row needing every kind of escaping", () => {
    const original = [["titre", "description"], ['Clio, "bon état"', "Ligne 1\nLigne 2"]];
    const csv = stringifyCsv(original);
    expect(parseCsv(csv)).toEqual(original);
  });
});

describe("injection de formule dans un tableur (Lot 232)", () => {
  it("neutralise un champ commençant par =, +, -, @, tabulation ou retour chariot avec une apostrophe, entre guillemets", () => {
    expect(stringifyCsv([["=cmd|' /C calc'!A0"]])).toBe("\"'=cmd|' /C calc'!A0\"");
    expect(stringifyCsv([["+213 555 00 00"]])).toBe("\"'+213 555 00 00\"");
    expect(stringifyCsv([["- Toit ouvrant"]])).toBe("\"'- Toit ouvrant\"");
    expect(stringifyCsv([["@SUM(A1)"]])).toBe("\"'@SUM(A1)\"");
    expect(stringifyCsv([["\t=1+1"]])).toBe("\"'\t=1+1\"");
  });

  it("laisse intacts un nombre, un texte ordinaire et un champ contenant un = ailleurs qu'en tête", () => {
    expect(stringifyCsv([["2200000", "Renault Clio", "a=b"]])).toBe("2200000,Renault Clio,a=b");
  });

  it("à l'import, retire l'apostrophe de garde pour qu'un export se réimporte à l'identique", () => {
    const original = [["titre", "description", "prix"], ["- Toit ouvrant", "=SUM(A1)", "2200000"]];
    const records = csvRowsToRecords(parseCsv(stringifyCsv(original)));
    expect(records).toEqual([{ titre: "- Toit ouvrant", description: "=SUM(A1)", prix: "2200000" }]);
    // Une apostrophe qui ne garde rien (texte ordinaire) est conservée.
    expect(csvRowsToRecords([["titre"], ["'Occasion' garantie"]])).toEqual([{ titre: "'Occasion' garantie" }]);
  });
});
