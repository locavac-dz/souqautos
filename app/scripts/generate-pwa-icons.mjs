// Lot 120 — génère les icônes de l'application installable à partir du logo (src/app/icon.svg).
//
//   node scripts/generate-pwa-icons.mjs
//
// Écrit public/icons/icon-192.png, icon-512.png (icônes « any ») et icon-maskable-512.png
// (icône « maskable » : le dessin tient dans la zone de sécurité centrale de 80 %, car Android
// la découpe en cercle, en carré arrondi… selon le téléphone). Les PNG générés sont versionnés :
// ce script ne sert qu'à les refaire si le logo change.
//
// Correctif (préparation Play Store) — le dessin ci-dessous ne correspondait plus au logo réel du site
// (deux anneaux verts/orange sans rapport avec src/app/icon.svg) : repris pour tracer le même losange
// dégradé turquoise + « S » que partout ailleurs (en-tête, favicon, apple-icon, icônes Android).

import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = path.resolve(process.cwd(), "public/icons");

const GRADIENT_DEF = `
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#0BBFB0"/>
    <stop offset="100%" stop-color="#0891B2"/>
  </linearGradient>
`;
const DIAMOND_S = `
  <path d="M 32 0 L 64 32 L 32 64 L 0 32 Z" fill="url(#g)"/>
  <text x="32" y="46" text-anchor="middle" fill="white" font-size="40" font-weight="bold" font-family="Georgia, 'Times New Roman', serif">S</text>
`;

// Icône « any » : logo sur fond transparent, comme src/app/icon.svg.
function plainIconSvg(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs>${GRADIENT_DEF}</defs>${DIAMOND_S}</svg>`;
}

// Icône « maskable » : fond blanc plein jusqu'au bord (un masque circulaire ou arrondi ne doit jamais révéler
// un coin transparent) — losange ramené à 72 % pour rester dans la zone de sécurité recommandée de 80 % (les
// lanceurs Android rognent jusqu'à 20 % sur les bords ; vérifié par tests/pwa-manifest.test.ts).
function maskableIconSvg(size) {
  const scale = 0.72;
  const offset = (64 * (1 - scale)) / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>${GRADIENT_DEF}</defs>
    <rect width="64" height="64" fill="#ffffff"/>
    <g transform="translate(${offset} ${offset}) scale(${scale})">${DIAMOND_S}</g>
  </svg>`;
}

mkdirSync(OUT, { recursive: true });

const targets = [
  { file: "icon-192.png", svg: plainIconSvg(192) },
  { file: "icon-512.png", svg: plainIconSvg(512) },
  { file: "icon-maskable-512.png", svg: maskableIconSvg(512) },
];

for (const { file, svg } of targets) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(OUT, file));
  console.log(`✓ public/icons/${file}`);
}
