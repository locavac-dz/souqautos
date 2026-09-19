// Lot 120 — génère les icônes de l'application installable à partir du logo (src/app/icon.svg).
//
//   node scripts/generate-pwa-icons.mjs
//
// Écrit public/icons/icon-192.png, icon-512.png (icônes « any ») et icon-maskable-512.png
// (icône « maskable » : le dessin tient dans la zone de sécurité centrale de 80 %, car Android
// la découpe en cercle, en carré arrondi… selon le téléphone). Les PNG générés sont versionnés :
// ce script ne sert qu'à les refaire si le logo change.

import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = path.resolve(process.cwd(), "public/icons");
const NAVY = "#12222e";
const ORANGE = "#c1622b";
const BACKGROUND = "#ffffff";

// Le logo occupe 64 × 64 ; `scale` le réduit autour du centre pour laisser une marge.
function iconSvg(size, scale) {
  const offset = (size - 64 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BACKGROUND}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <circle cx="26" cy="32" r="18" fill="none" stroke="${NAVY}" stroke-width="6.5"/>
    <circle cx="40" cy="32" r="18" fill="none" stroke="${ORANGE}" stroke-width="6.5"/>
  </g>
</svg>`;
}

const targets = [
  { file: "icon-192.png", size: 192, scale: (192 * 0.72) / 64 },
  { file: "icon-512.png", size: 512, scale: (512 * 0.72) / 64 },
  // 0,56 : le dessin (largeur 58 sur 64 d'origine) reste dans le cercle de sécurité de 80 %.
  { file: "icon-maskable-512.png", size: 512, scale: (512 * 0.56) / 64 },
];

mkdirSync(OUT, { recursive: true });
for (const { file, size, scale } of targets) {
  await sharp(Buffer.from(iconSvg(size, scale))).png({ compressionLevel: 9 }).toFile(path.join(OUT, file));
  console.log(`✓ public/icons/${file} (${size}×${size})`);
}
