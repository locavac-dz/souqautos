import { stringifyCsv } from "@/lib/csv";

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
};

const BOM = "﻿";

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => c.header);
  const data = rows.map((row) =>
    columns.map((col) => {
      const v = col.value(row);
      if (v == null) return "";
      if (typeof v === "boolean") return v ? "oui" : "non";
      return String(v);
    }),
  );
  return BOM + stringifyCsv([header, ...data]);
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
