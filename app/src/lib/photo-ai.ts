import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { callAnthropicVision } from "./anthropic-client";
import { prisma } from "./prisma";
import { uploadsRoot } from "./uploads-serve";

// Lot 247 — analyse Claude Vision des photos d'annonce (V3, §16 « analyse photo »).
// Complète l'empreinte SHA-256 (détection de doublons exacts, Lot 77) par une
// analyse sémantique : watermark visible, photo de catalogue professionnel,
// nature du sujet (extérieur, habitacle, moteur, document, autre).
// Repli silencieux si ANTHROPIC_API_KEY absent ou si l'appel échoue.

export type PhotoAiTag = {
  subject: "exterior" | "interior" | "engine" | "document" | "other";
  hasWatermark: boolean;
  isProfessionalStock: boolean;
  note: string | null;
};

const PHOTO_AI_SUBJECTS = ["exterior", "interior", "engine", "document", "other"] as const;

const PHOTO_AI_SYSTEM =
  'Tu analyses une photo d\'annonce automobile pour la plateforme Souq Autos (marché algérien). Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après :\n{"subject":"exterior"|"interior"|"engine"|"document"|"other","hasWatermark":boolean,"isProfessionalStock":boolean,"note":string|null}\n\n- subject : ce que montre principalement la photo (exterior=extérieur véhicule, interior=habitacle, engine=moteur/capot ouvert, document=papiers/carte grise/plaque, other=autre)\n- hasWatermark : true si tu vois un filigrane, logo watermark ou texte superposé d\'un autre site/service\n- isProfessionalStock : true si la photo ressemble à un catalogue constructeur ou studio (fond neutre, éclairage parfait, absent de contexte réel)\n- note : observation concise en français (< 80 car.) si quelque chose est inhabituel, null sinon';

// Relit une photo depuis son chemin de stockage (disque local ou URL S3/HTTP).
// Ne lève jamais d'exception — retourne null si le fichier est inaccessible.
async function readStoredPhotoBytes(storedPath: string): Promise<Buffer | null> {
  try {
    if (storedPath.startsWith("http://") || storedPath.startsWith("https://")) {
      const res = await fetch(storedPath);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    if (storedPath.startsWith("/uploads/")) {
      const rel = storedPath.slice("/uploads/".length); // "listings/uuid.jpg"
      return await readFile(path.join(uploadsRoot(), rel));
    }
    return null;
  } catch (err) {
    console.warn("[photo-ai] lecture photo impossible", (err as Error).message);
    return null;
  }
}

// Analyse une photo (buffer JPEG). Retourne null sans clé API ou si l'appel
// échoue — jamais une valeur inventée.
export async function analyzePhoto(imageBuffer: Buffer): Promise<PhotoAiTag | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  // Redimensionne à 400 px pour l'analyse : largement suffisant pour la
  // classification, 3× à 4× moins cher en tokens qu'envoyer les 1 600 px stockés.
  let small: Buffer;
  try {
    small = await sharp(imageBuffer)
      .resize({ width: 400, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
  } catch (err) {
    console.warn("[photo-ai] redimensionnement impossible", (err as Error).message);
    return null;
  }

  try {
    const text = await callAnthropicVision({
      system: PHOTO_AI_SYSTEM,
      imageBuffer: small,
      prompt: "Analyse cette photo.",
      maxTokens: 150,
    });
    if (!text) return null;

    const parsed = JSON.parse(text) as Record<string, unknown>;
    const subject = PHOTO_AI_SUBJECTS.includes(parsed.subject as (typeof PHOTO_AI_SUBJECTS)[number])
      ? (parsed.subject as PhotoAiTag["subject"])
      : "other";

    return {
      subject,
      hasWatermark: Boolean(parsed.hasWatermark),
      isProfessionalStock: Boolean(parsed.isProfessionalStock),
      note: typeof parsed.note === "string" ? parsed.note.slice(0, 200) : null,
    };
  } catch (err) {
    console.warn("[photo-ai] analyse impossible", (err as Error).message);
    return null;
  }
}

// Relit la photo depuis le stockage, l'analyse, persiste le résultat.
export async function analyzeAndStorePhotoTags(photoId: string, storedPath: string): Promise<void> {
  const buffer = await readStoredPhotoBytes(storedPath);
  if (!buffer) return;

  const tag = await analyzePhoto(buffer);
  if (!tag) return;

  await prisma.listingPhoto.update({
    where: { id: photoId },
    data: { aiTags: JSON.stringify(tag) },
  });
}

// Analyse toutes les photos d'une annonce en parallèle.
// Utilisé via after() à la soumission — zéro impact sur la latence perçue.
export async function analyzeListingPhotos(photos: { id: string; path: string }[]): Promise<void> {
  await Promise.all(photos.map((p) => analyzeAndStorePhotoTags(p.id, p.path)));
}
