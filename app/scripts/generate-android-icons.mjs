// Génère les icônes PNG Android depuis le SVG du logo mark (double anneau).
// Usage : node scripts/generate-android-icons.mjs
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// SVG de l'icône : double anneau sur fond gradient vert→bleu
function makeSvg(size) {
  const pad = Math.round(size * 0.14);
  const cx1 = Math.round(size * 0.38);
  const cx2 = Math.round(size * 0.62);
  const cy = Math.round(size * 0.50);
  const r = Math.round(size * 0.24);
  const sw = Math.round(size * 0.10);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="url(#bg)"/>
  <circle cx="${cx1}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="${sw}" opacity="0.9"/>
  <circle cx="${cx2}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="${sw}" opacity="0.75"/>
</svg>`;
}

const sizes = [
  { name: "mdpi",    px: 48  },
  { name: "hdpi",    px: 72  },
  { name: "xhdpi",   px: 96  },
  { name: "xxhdpi",  px: 144 },
  { name: "xxxhdpi", px: 192 },
];

for (const { name, px } of sizes) {
  const svg = Buffer.from(makeSvg(px));
  const dest = path.join(root, `android/app/src/main/res/mipmap-${name}/ic_launcher.png`);
  await sharp(svg).png().toFile(dest);
  console.log(`✓ ${name} — ${px}×${px}px → ${dest}`);

  // Round icon (même image, sharp ne "découpe" pas — Android la masque lui-même)
  const destRound = path.join(root, `android/app/src/main/res/mipmap-${name}/ic_launcher_round.png`);
  await sharp(svg).png().toFile(destRound);
  console.log(`  ↳ round`);
}

console.log("\nDone. Icônes Android générées.");
