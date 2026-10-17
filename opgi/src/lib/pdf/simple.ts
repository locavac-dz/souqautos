// Générateur PDF minimal, SANS dépendance : une page A4, police Helvetica
// (WinAnsiEncoding pour les accents français), titre + lignes « label : valeur ».
// Pur et déterministe → testable. Destiné aux récépissés/fiches de données
// (aucun habillage juridique inventé : contenu = données saisies).
//
// Tout le fichier est construit en latin1 (1 octet/caractère) : les offsets de
// la table xref se calculent alors directement par la longueur des chaînes.

export interface LignePdf {
  label: string;
  valeur: string;
}
export interface DocumentPdf {
  titre: string;
  sousTitre?: string;
  lignes: LignePdf[];
  pied?: string;
}

const A4 = { largeur: 595, hauteur: 842 };
const MARGE_X = 56;

/** Échappe le texte pour un littéral de chaîne PDF « (...) ». */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]+/g, " ");
}

/** Un bloc texte positionné en absolu (évite toute dérive de matrice). */
function texte(x: number, y: number, taille: number, s: string): string {
  return `BT /F1 ${taille} Tf 1 0 0 1 ${x} ${y} Tm (${esc(s)}) Tj ET\n`;
}

function construireContenu(doc: DocumentPdf): string {
  let y = A4.hauteur - 72;
  let c = texte(MARGE_X, y, 18, doc.titre);
  if (doc.sousTitre) {
    y -= 22;
    c += texte(MARGE_X, y, 11, doc.sousTitre);
  }
  y -= 28;
  for (const l of doc.lignes) {
    c += texte(MARGE_X, y, 11, `${l.label} : ${l.valeur}`);
    y -= 18;
    if (y < 72) break; // une seule page (suffisant pour un récépissé)
  }
  if (doc.pied) {
    c += texte(MARGE_X, 56, 8, doc.pied);
  }
  return c;
}

/** Produit les octets d'un PDF à une page. */
export function documentPdf(doc: DocumentPdf): Buffer {
  const contenu = construireContenu(doc);
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.largeur} ${A4.hauteur}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${Buffer.byteLength(contenu, "latin1")} >>\nstream\n${contenu}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objets.forEach((corps, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${corps}\nendobj\n`;
  });

  const debutXref = pdf.length;
  const n = objets.length + 1; // +1 pour l'objet libre 0
  let xref = `xref\n0 ${n}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${off.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += xref;
  pdf += `trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}
