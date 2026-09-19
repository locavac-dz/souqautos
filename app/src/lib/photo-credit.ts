// Lot 125 — crédit d'une photo publiée sous licence libre : logique pure, testée sans base.

export type PhotoCredit = {
  author: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string | null;
};

type CreditColumns = {
  creditAuthor: string | null;
  creditLicense: string | null;
  creditLicenseUrl: string | null;
  creditSourceUrl: string | null;
};

// Seuls des liens vers la page de la photo (Wikimedia Commons) et vers le texte de la licence
// (Creative Commons) sont affichés. Les crédits sont écrits par nos propres scripts, mais un lien
// venu de la base ne doit jamais pouvoir mener ailleurs ni utiliser un autre schéma (`javascript:`).
const ALLOWED_HOSTS = new Set(["commons.wikimedia.org", "creativecommons.org", "www.creativecommons.org"]);

export function safeCreditUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return null;
    return ALLOWED_HOSTS.has(parsed.hostname.toLowerCase()) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

// Un crédit n'existe que s'il nomme l'auteur ET la licence : c'est le minimum exigé par CC BY et
// CC BY-SA. Sans cela, rien n'est affiché (une photo de vendeur n'a aucun crédit).
export function toPhotoCredit(photo: CreditColumns): PhotoCredit | null {
  const author = photo.creditAuthor?.trim();
  const license = photo.creditLicense?.trim();
  if (!author || !license) return null;
  return {
    author,
    license,
    licenseUrl: safeCreditUrl(photo.creditLicenseUrl),
    sourceUrl: safeCreditUrl(photo.creditSourceUrl),
  };
}

// Les crédits distincts d'une annonce, dans l'ordre des photos, sans doublon.
export function collectPhotoCredits(photos: CreditColumns[]): PhotoCredit[] {
  const seen = new Set<string>();
  const credits: PhotoCredit[] = [];
  for (const photo of photos) {
    const credit = toPhotoCredit(photo);
    if (!credit) continue;
    const key = `${credit.author}|${credit.license}|${credit.sourceUrl ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    credits.push(credit);
  }
  return credits;
}
