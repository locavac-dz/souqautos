// Génère les icônes PNG Android depuis le SVG du logo mark (monogramme S).
// Usage : node scripts/generate-android-icons.mjs
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function makeSvg(size) {
  const rx = Math.round(size * 0.22);
  const fs = Math.round(size * 0.78);
  const cy = Math.round(size * 0.77);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>
  <text x="${size / 2}" y="${cy}" text-anchor="middle" fill="white" font-size="${fs}" font-weight="bold" font-family="Arial Black, Impact, sans-serif">S</text>
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

  const destRound = path.join(root, `android/app/src/main/res/mipmap-${name}/ic_launcher_round.png`);
  await sharp(svg).png().toFile(destRound);
  console.log(`  ↳ round`);
}

console.log("\nDone. Icônes Android générées.");
