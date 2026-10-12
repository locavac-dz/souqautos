import { describe, expect, it } from "vitest";

import { buildCsv, csvResponse, type CsvColumn } from "@/lib/csv-export";

type Item = { name: string; age: number; active: boolean; note: string | null };

const COLUMNS: CsvColumn<Item>[] = [
  { header: "Nom", value: (r) => r.name },
  { header: "Âge", value: (r) => r.age },
  { header: "Actif", value: (r) => r.active },
  { header: "Note", value: (r) => r.note },
];

describe("buildCsv", () => {
  it("produces header-only CSV for empty rows", () => {
    const csv = buildCsv([], COLUMNS);
    expect(csv).toBe("﻿Nom,Âge,Actif,Note");
  });

  it("starts with UTF-8 BOM", () => {
    const csv = buildCsv([], COLUMNS);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("serializes rows with correct types", () => {
    const rows: Item[] = [
      { name: "Alice", age: 30, active: true, note: "ok" },
      { name: "Bob", age: 25, active: false, note: null },
    ];
    const csv = buildCsv(rows, COLUMNS);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Nom,Âge,Actif,Note");
    expect(lines[1]).toBe("Alice,30,oui,ok");
    expect(lines[2]).toBe("Bob,25,non,");
  });

  it("escapes commas and quotes in values", () => {
    const rows: Item[] = [{ name: 'O"Brien, Jr.', age: 40, active: true, note: "a,b" }];
    const csv = buildCsv(rows, COLUMNS);
    const dataLine = csv.slice(1).split("\r\n")[1];
    expect(dataLine).toContain('"O""Brien');
    expect(dataLine).toContain('"a,b"');
  });

  it("guards formula injection with leading apostrophe", () => {
    const rows: Item[] = [{ name: "=cmd|'calc'", age: 1, active: false, note: "+danger" }];
    const csv = buildCsv(rows, COLUMNS);
    const dataLine = csv.slice(1).split("\r\n")[1];
    expect(dataLine).toContain("'=cmd");
    expect(dataLine).toContain("'+danger");
  });
});

describe("csvResponse", () => {
  it("returns a Response with correct headers", () => {
    const res = csvResponse("data", "test.csv");
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="test.csv"');
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("contains the CSV body", async () => {
    const res = csvResponse("hello", "f.csv");
    const body = await res.text();
    expect(body).toBe("hello");
  });
});
