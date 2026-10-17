// Analyseur CSV minimal et robuste (sans dépendance) : gère les champs entre
// guillemets, les virgules et sauts de ligne protégés, les guillemets doublés
// (""), le BOM et les fins de ligne CRLF/LF. Suffisant pour les imports initiaux.

/** Découpe un texte CSV en lignes de champs. */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input; // BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      pushField();
      i++;
      continue;
    }
    if (c === "\r") {
      // \r\n ou \r seul
      if (text[i + 1] === "\n") i++;
      pushRow();
      i++;
      continue;
    }
    if (c === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // Dernier champ/ligne si le texte ne finit pas par un saut de ligne.
  if (field.length > 0 || row.length > 0) pushRow();

  // Supprime une éventuelle ligne finale totalement vide.
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export interface CsvRecords {
  headers: string[];
  records: Record<string, string>[];
}

/**
 * Convertit un CSV à en-tête en enregistrements clé→valeur. Les en-têtes sont
 * normalisés (minuscule, sans espaces superflus). Les colonnes manquantes sur
 * une ligne valent "".
 */
export function toRecords(input: string): CsvRecords {
  const rows = parseCsv(input);
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0]!.map((h) => h.trim().toLowerCase());
  const records = rows.slice(1).map((r) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h] = (r[idx] ?? "").trim();
    });
    return rec;
  });
  return { headers, records };
}
