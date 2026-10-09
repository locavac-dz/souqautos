// Lot 125 — photos des annonces de démonstration.
//
// Les 24 photos de `prisma/demo-photos/` viennent de Wikimedia Commons (licences libres, voir
// `CREDITS.json` et `README.md` du dossier). Elles sont rangées dans le dépôt pour que
// `npm run db:seed:demo` n'ait besoin d'aucun accès réseau. Elles passent par le MÊME traitement que
// la photo d'un vendeur (`savePhoto` : orientation, 1 600 px, JPEG, empreinte, qualité), et leur crédit
// (auteur, licence, liens) est enregistré avec elles.
//
// Lot 263 : un badge « DÉMO » semi-transparent est incrusté centré en bas de chaque photo
// (placeholder SVG et vraies photos Wikimedia) pour distinguer visuellement les annonces de
// démonstration. Centré, et non dans un coin, parce que les cartes affichent les photos en 4:3
// avec object-cover : un coin d'une photo 16:9 est rogné, le centre jamais. Pour régénérer les
// photos d'une base existante : npm run db:demo-photos -- --force.

import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { storeProcessedImage } from "../src/lib/uploads";

const DIR = path.resolve(__dirname, "demo-photos");

export type DemoPhotoCredit = {
  file: string;
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
};

export function loadDemoPhotoCredits(): Record<string, DemoPhotoCredit> {
  return JSON.parse(readFileSync(path.join(DIR, "CREDITS.json"), "utf8"));
}

export type StoredDemoPhoto = {
  path: string;
  sha256: string;
  qualityFlags: string;
  creditAuthor: string;
  creditLicense: string;
  creditLicenseUrl: string;
  creditSourceUrl: string;
};

// Badge SVG « DÉMO » centré en bas de l'image (dimensions en px).
// Centré horizontalement pour ne jamais être rogné par object-cover quelle que soit la largeur de l'image.
// Taille PROPORTIONNELLE à la photo (≈ 6,5 % de sa largeur pour le texte) : un badge de 26 px sur une photo de
// 1 600 px devenait illisible une fois la carte réduite à 300 px — le porteur de projet veut qu'on ne puisse pas
// confondre une annonce de démonstration avec une vraie.
export function demoBadgeSvg(w: number, h: number): Buffer {
  const font = Math.max(26, Math.round(w * 0.065));
  const bw = Math.round(font * 4.4);
  const bh = Math.round(font * 1.8);
  const margin = Math.round(w * 0.03);
  const x = Math.round((w - bw) / 2);
  const y = h - bh - margin;
  const cx = w / 2;
  const cy = y + bh / 2 + Math.round(font * 0.36);
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="${Math.round(font * 0.3)}" fill="rgba(0,0,0,0.68)"/>
    <text x="${cx}" y="${cy}" font-family="Arial, sans-serif" font-size="${font}" fill="#ffffff" text-anchor="middle" font-weight="bold" letter-spacing="${Math.round(font * 0.18)}">DÉMO</text>
  </svg>`;
  return Buffer.from(svg);
}

// `null` quand il n'existe pas de photo pour ce modèle : l'appelant garde alors son visuel de substitution.
export async function storeDemoPhoto(brand: string, model: string): Promise<StoredDemoPhoto | null> {
  const credit = loadDemoPhotoCredits()[`${brand} ${model}`];
  if (!credit) return null;
  const bytes = readFileSync(path.join(DIR, credit.file));

  // Redimensionner (≤ 1 600 px de large) + incruster le badge DÉMO.
  const meta = await sharp(bytes).metadata();
  const srcW = meta.width ?? 1200;
  const srcH = meta.height ?? 900;
  const maxW = 1600;
  const w = Math.min(srcW, maxW);
  const h = Math.round(srcH * (w / srcW));

  const processed = await sharp(bytes)
    .resize(w, h, { fit: "fill" })
    .composite([{ input: demoBadgeSvg(w, h), blend: "over" }])
    .jpeg({ quality: 82 })
    .toBuffer();

  const sha256 = createHash("sha256").update(processed).digest("hex");
  const filename = `${randomUUID()}.jpg`;
  const storedPath = await storeProcessedImage("listings", filename, processed);

  return {
    path: storedPath,
    sha256,
    qualityFlags: JSON.stringify([]),
    creditAuthor: credit.author,
    creditLicense: credit.license,
    creditLicenseUrl: credit.licenseUrl,
    creditSourceUrl: credit.sourceUrl,
  };
}
