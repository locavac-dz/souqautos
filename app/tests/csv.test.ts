import { describe, expect, it } from "vitest";
import { parseCsv, csvRowsToRecords } from "@/lib/csv";

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
