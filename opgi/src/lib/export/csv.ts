// Sérialisation CSV (RFC 4180) : un champ est mis entre guillemets s'il contient
// une virgule, un guillemet ou un saut de ligne ; les guillemets internes sont
// doublés. Séparateur virgule, fin de ligne CRLF. Préfixé d'un BOM pour qu'Excel
// ouvre l'UTF‑8 correctement.
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined): string => {
    const s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lignes = [headers, ...rows].map((r) => r.map(escape).join(","));
  return "﻿" + lignes.join("\r\n") + "\r\n";
}
