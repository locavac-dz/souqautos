import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildShareCard, type ShareCard } from "@/lib/share-image";
import { SHARE_HEIGHT, SHARE_WIDTH } from "@/lib/share-image-photo";
import { MAX_CACHED_IMAGES, clearShareImageCache, getShareImage } from "@/lib/share-image-render";

// Lot 142 — le dessin de la carte de partage (vrai moteur ImageResponse + sharp, aucun mock) et son cache mémoire.

const CARD: ShareCard = buildShareCard({ brandLabel: "Renault", modelLabel: "Clio", year: 2019, mileage: 60000, fuelType: "DIESEL", price: 1_900_000, wilayaNameFr: "Alger" });
const cardWithPrice = (price: number): ShareCard => ({ ...CARD, price: `${price} DA` });

async function photo(color: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({ create: { width: SHARE_WIDTH, height: SHARE_HEIGHT, channels: 3, background: color } }).jpeg({ quality: 90 }).toBuffer();
}

// Luminosité moyenne d'une zone (0 = noir, 255 = blanc).
async function meanBrightness(image: Buffer, region: { left: number; top: number; width: number; height: number }): Promise<number> {
  // `stats()` ignore un `extract()` placé avant lui dans la même chaîne (il mesure l'image entière) : on découpe d'abord.
  const cropped = await sharp(image).extract(region).toBuffer();
  const { channels } = await sharp(cropped).stats();
  return (channels[0].mean + channels[1].mean + channels[2].mean) / 3;
}

beforeEach(() => clearShareImageCache());

describe("dessin de la carte", () => {
  it("produit un JPEG de 1200 × 630 léger, avec ou sans photo", async () => {
    for (const source of [await photo({ r: 220, g: 220, b: 220 }), null]) {
      const image = await getShareImage(CARD, source ? "p" : "", async () => source);
      const meta = await sharp(image).metadata();
      expect({ format: meta.format, width: meta.width, height: meta.height }).toEqual({ format: "jpeg", width: SHARE_WIDTH, height: SHARE_HEIGHT });
      expect(image.length).toBeLessThan(300 * 1024); // au-delà, WhatsApp affiche mal l'aperçu
    }
  });

  it("dessine réellement le texte par-dessus la photo : le bas s'assombrit, le haut reste celui de la photo", async () => {
    const light = await photo({ r: 235, g: 235, b: 235 });
    const image = await getShareImage(CARD, "p", async () => light);
    const top = await meanBrightness(image, { left: 700, top: 20, width: 480, height: 200 }); // loin de la pastille « Souq Auto »
    const bottom = await meanBrightness(image, { left: 700, top: 400, width: 480, height: 200 }); // sous le dégradé, à droite du texte
    expect(top).toBeGreaterThan(200); // la photo claire est intacte en haut
    expect(bottom).toBeLessThan(100); // le dégradé sombre la recouvre en bas : sans lui, le texte blanc serait illisible
  });

  it("la pastille du prix est bien blanche sur la photo, et le texte du prix y est sombre (lisibilité)", async () => {
    const dark = await photo({ r: 20, g: 20, b: 20 });
    const image = await getShareImage(CARD, "p", async () => dark);
    // La pastille occupe le bas gauche : on y trouve du blanc franc même sur une photo noire.
    const pill = await meanBrightness(image, { left: 60, top: 485, width: 30, height: 60 });
    expect(pill).toBeGreaterThan(200);
  });

  it("deux annonces différentes ne donnent pas la même image", async () => {
    const source = await photo({ r: 120, g: 120, b: 120 });
    const a = await getShareImage(cardWithPrice(1_000_000), "p", async () => source);
    const b = await getShareImage(cardWithPrice(9_000_000), "p", async () => source);
    expect(a.equals(b)).toBe(false);
  });

  it("sans photo, dessine une carte pleine (fond en dégradé), pas une image vide ni transparente", async () => {
    const image = await getShareImage(CARD, "", async () => null);
    const stats = await sharp(image).stats();
    expect(stats.channels[2].mean).toBeGreaterThan(stats.channels[0].mean); // dégradé bleuté : plus de bleu que de rouge
    expect(stats.channels[0].stdev).toBeGreaterThan(5); // et du texte dessus, donc de la variation
  });
});

describe("cache mémoire", () => {
  it("ressert la même image sans recharger la photo ni redessiner", async () => {
    const load = vi.fn(async () => await photo({ r: 100, g: 100, b: 100 }));
    const first = await getShareImage(CARD, "p", load);
    const second = await getShareImage(CARD, "p", load);
    expect(second).toBe(first); // le même objet : rien n'a été recalculé
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("des demandes simultanées de la même carte ne la dessinent qu'une fois (lien collé dans un groupe)", async () => {
    const load = vi.fn(async () => await photo({ r: 100, g: 100, b: 100 }));
    const images = await Promise.all(Array.from({ length: 30 }, () => getShareImage(CARD, "p", load)));
    expect(load).toHaveBeenCalledTimes(1);
    expect(new Set(images).size).toBe(1);
  });

  it("un changement de prix, de texte ou de photo donne une NOUVELLE carte : jamais une carte périmée", async () => {
    const load = vi.fn(async () => null);
    const base = await getShareImage(CARD, "photo-1", load);
    expect(await getShareImage(cardWithPrice(5), "photo-1", load)).not.toBe(base); // prix modifié
    expect(await getShareImage({ ...CARD, heading: "Autre" }, "photo-1", load)).not.toBe(base); // titre modifié
    expect(await getShareImage(CARD, "photo-2", load)).not.toBe(base); // photo remplacée
    expect(load).toHaveBeenCalledTimes(4);
  });

  it("reste borné : les cartes les plus anciennes sortent, une carte consultée récemment est gardée", async () => {
    const load = vi.fn(async () => null);
    await getShareImage(cardWithPrice(0), "", load); // la plus ancienne
    await getShareImage(cardWithPrice(1), "", load); // la 2e plus ancienne, qu'on va garder en la consultant
    for (let i = 2; i < MAX_CACHED_IMAGES; i++) await getShareImage(cardWithPrice(i), "", load);
    expect(load).toHaveBeenCalledTimes(MAX_CACHED_IMAGES); // le cache est exactement plein, rien n'est encore sorti
    await getShareImage(cardWithPrice(1), "", load); // consultée : devient la plus récente
    // DEUX cartes de plus : sans le rafraîchissement à la consultation, la n°1 serait la 2e sortie ; avec lui, ce sera la n°2.
    await getShareImage(cardWithPrice(MAX_CACHED_IMAGES), "", load);
    await getShareImage(cardWithPrice(MAX_CACHED_IMAGES + 1), "", load);
    load.mockClear();
    await getShareImage(cardWithPrice(1), "", load);
    expect(load).not.toHaveBeenCalled(); // la n°1, consultée récemment, est restée
    await getShareImage(cardWithPrice(0), "", load);
    await getShareImage(cardWithPrice(2), "", load);
    expect(load).toHaveBeenCalledTimes(2); // les n°0 et n°2, non consultées, sont sorties : il faut les redessiner
  }, 60_000);

  it("un échec de chargement n'est PAS mis en cache : la demande suivante réessaie", async () => {
    let attempts = 0;
    const flaky = async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("stockage indisponible");
      return null;
    };
    await expect(getShareImage(CARD, "p", flaky)).rejects.toThrow("stockage indisponible");
    const image = await getShareImage(CARD, "p", flaky);
    expect((await sharp(image).metadata()).width).toBe(SHARE_WIDTH);
    expect(attempts).toBe(2);
  });
});
