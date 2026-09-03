// Lot 41 — import de stock en masse : petit analyseur CSV maison (RFC4180 —
// champs entre guillemets, guillemet doublé pour échapper, virgule/retour à
// la ligne autorisés dans un champ cité) plutôt qu'une dépendance externe —
// le format est entièrement défini par nous (pas de variantes exotiques à
// couvrir), et une fonction pure est directement testable sans bibliothèque.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Ignore un BOM UTF-8 éventuel en tête de fichier (Excel en ajoute un).
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }

  return rows;
}

// Transforme les lignes brutes en tableau d'objets keyés par l'en-tête (première
// ligne) — les colonnes en trop dans une ligne sont ignorées, les colonnes
// manquantes valent "".
export function csvRowsToRecords(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const [header, ...dataRows] = rows;
  return dataRows.map((row) => {
    const record: Record<string, string> = {};
    header.forEach((key, i) => {
      record[key.trim()] = (row[i] ?? "").trim();
    });
    return record;
  });
}
