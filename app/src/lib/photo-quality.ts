import sharp from "sharp";

// Lot 86 — "analyse photo" (docs/ARCHITECTURE.md §36, phase V3 IA) : jamais
// une IA de vision fabriquée sans base réelle (aucune clé Anthropic capable
// d'analyse d'image n'est de toute façon disponible sur cette machine) —
// seulement des statistiques d'image réelles (sharp), honnêtement présentées
// comme telles au vendeur, jamais comme un jugement automatisé définitif.
// Seuils volontairement conservateurs : ne visent que des cas extrêmes et
// sans ambiguïté (photo quasiment noire/blanche/unie), jamais un jugement
// esthétique fin qui rejetterait à tort une photo simplement sombre par
// nature (véhicule sombre, éclairage intérieur).
export type PhotoQualityFlag = "low_resolution" | "too_dark" | "too_bright" | "near_solid_color";

const MIN_WIDTH = 640;
const DARK_MEAN_THRESHOLD = 30;
const BRIGHT_MEAN_THRESHOLD = 240;
const SOLID_COLOR_STDEV_THRESHOLD = 5;

export async function analyzePhotoQuality(buffer: Buffer): Promise<PhotoQualityFlag[]> {
  const flags: PhotoQualityFlag[] = [];

  const metadata = await sharp(buffer).metadata();
  if ((metadata.width ?? 0) < MIN_WIDTH) {
    flags.push("low_resolution");
  }

  const stats = await sharp(buffer).stats();
  // Les 3 premiers canaux sont toujours R/G/B (ou dupliqués si l'image est en
  // niveaux de gris) — le 4e canal éventuel (alpha) n'a aucun rapport avec la
  // luminosité et est ignoré.
  const colorChannels = stats.channels.slice(0, 3);
  const meanBrightness = colorChannels.reduce((sum, c) => sum + c.mean, 0) / colorChannels.length;
  if (meanBrightness < DARK_MEAN_THRESHOLD) {
    flags.push("too_dark");
  } else if (meanBrightness > BRIGHT_MEAN_THRESHOLD) {
    flags.push("too_bright");
  }

  const avgStdev = colorChannels.reduce((sum, c) => sum + c.stdev, 0) / colorChannels.length;
  if (avgStdev < SOLID_COLOR_STDEV_THRESHOLD) {
    flags.push("near_solid_color");
  }

  return flags;
}
