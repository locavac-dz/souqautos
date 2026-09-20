import qrcode from "qrcode-generator";

// Lot 138 — dessin du code QR à scanner avec l'application d'authentification (le secret y est contenu : il ne quitte jamais
// le serveur autrement que dans la réponse à la personne connectée qui active la fonction).
//
// On renvoie le DESSIN (une taille et un tracé SVG), jamais du HTML : la page l'affiche dans un <svg><path/></svg> construit
// par React, sans injection de balisage. Un tracé par rangée de modules sombres contigus, zone de silence de 4 modules (la
// valeur exigée par la norme : sans elle, certains lecteurs ne détectent pas le code).
export const QR_QUIET_ZONE = 4;

export type QrDrawing = { size: number; path: string };

export function qrDrawing(text: string): QrDrawing {
  const qr = qrcode(0, "M"); // version choisie automatiquement, correction d'erreur moyenne (15 %)
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  let path = "";
  for (let row = 0; row < count; row++) {
    let col = 0;
    while (col < count) {
      if (!qr.isDark(row, col)) {
        col += 1;
        continue;
      }
      let run = 1;
      while (col + run < count && qr.isDark(row, col + run)) run += 1;
      path += `M${col + QR_QUIET_ZONE} ${row + QR_QUIET_ZONE}h${run}v1h-${run}z`;
      col += run;
    }
  }
  return { size: count + 2 * QR_QUIET_ZONE, path };
}

// Relit un tracé (utilisé par les tests pour prouver que le dessin reproduit exactement la matrice du code).
export function drawingToMatrix(drawing: QrDrawing): boolean[][] {
  const matrix = Array.from({ length: drawing.size }, () => Array<boolean>(drawing.size).fill(false));
  for (const match of drawing.path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    const [x, y, run] = [Number(match[1]), Number(match[2]), Number(match[3])];
    for (let i = 0; i < run; i++) matrix[y][x + i] = true;
  }
  return matrix;
}
