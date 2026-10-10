// Génère les icônes Android (lanceur classique + icône adaptative) depuis le vrai logo du site — le losange
// dégradé turquoise + « S » de src/app/icon.svg. Avant ce correctif, ce script dessinait un carré arrondi
// vert-bleu sans rapport avec l'identité du site (ni la forme, ni le dégradé, ni la police du « S »).
// Usage : node scripts/generate-android-icons.mjs
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

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

// Lanceur classique (< Android 8) : logo complet sur fond blanc plein, comme ic_launcher_background.xml.
function legacySvg(size) {
  const scale = (size * 0.72) / 64;
  const offset = (size - 64 * scale) / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>${GRADIENT_DEF}</defs>
  <rect width="${size}" height="${size}" fill="#ffffff"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${DIAMOND_S}</g>
</svg>`;
}

// Icône adaptative (Android 8+) : le fond uni vient de ic_launcher_background.xml (blanc) — seul le premier
// plan est généré ici, sur fond transparent, dans la zone de sécurité centrale de 66 dp sur un canevas de
// 108 dp (~61 %) : le masque (cercle, carré arrondi…) appliqué par le launcher varie selon le téléphone.
function foregroundSvg(size) {
  const scale = (size * 0.58) / 64;
  const offset = (size - 64 * scale) / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>${GRADIENT_DEF}</defs>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${DIAMOND_S}</g>
</svg>`;
}

const sizes = [
  { name: "mdpi", legacy: 48, fg: 108 },
  { name: "hdpi", legacy: 72, fg: 162 },
  { name: "xhdpi", legacy: 96, fg: 216 },
  { name: "xxhdpi", legacy: 144, fg: 324 },
  { name: "xxxhdpi", legacy: 192, fg: 432 },
];

for (const { name, legacy, fg } of sizes) {
  const dir = path.join(root, `android/app/src/main/res/mipmap-${name}`);
  const legacyBuf = Buffer.from(legacySvg(legacy));
  await sharp(legacyBuf).png().toFile(path.join(dir, "ic_launcher.png"));
  await sharp(legacyBuf).png().toFile(path.join(dir, "ic_launcher_round.png"));
  await sharp(Buffer.from(foregroundSvg(fg))).png().toFile(path.join(dir, "ic_launcher_foreground.png"));
  console.log(`✓ ${name} — lanceur ${legacy}×${legacy}px, premier plan adaptatif ${fg}×${fg}px`);
}

console.log("\nDone. Icônes Android régénérées à partir du vrai logo.");
