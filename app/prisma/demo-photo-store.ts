// Lot 125 — photos des annonces de démonstration.
//
// Les 24 photos de `prisma/demo-photos/` viennent de Wikimedia Commons (licences libres, voir
// `CREDITS.json` et `README.md` du dossier). Elles sont rangées dans le dépôt pour que
// `npm run db:seed:demo` n'ait besoin d'aucun accès réseau. Elles passent par le MÊME traitement que
// la photo d'un vendeur (`savePhoto` : orientation, 1 600 px, JPEG, empreinte, qualité), et leur crédit
// (auteur, licence, liens) est enregistré avec elles.

import { readFileSync } from "node:fs";
import path from "node:path";
import { savePhoto } from "../src/lib/uploads";

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

// `null` quand il n'existe pas de photo pour ce modèle : l'appelant garde alors son visuel de substitution.
export async function storeDemoPhoto(brand: string, model: string): Promise<StoredDemoPhoto | null> {
  const credit = loadDemoPhotoCredits()[`${brand} ${model}`];
  if (!credit) return null;
  const bytes = readFileSync(path.join(DIR, credit.file));
  const saved = await savePhoto(new File([bytes], credit.file, { type: "image/jpeg" }));
  return {
    path: saved.path,
    sha256: saved.sha256,
    qualityFlags: JSON.stringify(saved.qualityFlags),
    creditAuthor: credit.author,
    creditLicense: credit.license,
    creditLicenseUrl: credit.licenseUrl,
    creditSourceUrl: credit.sourceUrl,
  };
}
