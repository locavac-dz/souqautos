import { ImageResponse } from "next/og";
import sharp from "sharp";
import type { ShareCard } from "@/lib/share-image";
import { SHARE_HEIGHT, SHARE_WIDTH } from "@/lib/share-image-photo";

// Lot 142 — dessine la carte de partage : photo en fond, dégradé sombre en bas, marque et modèle, détails, prix.
//
// Pourquoi JPEG et pas PNG : `ImageResponse` ne produit que du PNG, qui pèse près d'1 Mo dès qu'une photo est dessous — or WhatsApp
// affiche mal, voire pas du tout, les aperçus lourds (repère courant : ~300 Ko). On dessine donc SEULEMENT le calque de texte avec
// `ImageResponse` (un PNG transparent, quelques Ko), qu'on pose avec `sharp` sur la photo déjà recadrée, puis on encode en JPEG.
// Bonus : la photo ne passe jamais par le moteur de dessin, ce qui le rend nettement moins coûteux.
//
// Sans photo (annonce publiée sans image), la carte reste utile : fond en dégradé, mêmes textes. Avant ce lot, une telle annonce
// n'avait AUCUNE image de partage — WhatsApp n'affichait qu'un lien nu.

const OVERLAY_ON_PHOTO = "linear-gradient(to top, rgba(15,23,42,0.94) 0%, rgba(15,23,42,0.80) 40%, rgba(15,23,42,0.0) 72%)";
const BACKGROUND_NO_PHOTO = "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)";

function overlayElement(card: ShareCard, hasPhoto: boolean) {
  // Le titre rétrécit quand il est long : le même dessin doit tenir de « Kia Rio » à « Mercedes-Benz Classe C Coupé ».
  const headingSize = card.heading.length > 20 ? 58 : 72;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 56,
        color: "white",
        backgroundImage: hasPhoto ? OVERLAY_ON_PHOTO : BACKGROUND_NO_PHOTO,
      }}
    >
      <div style={{ display: "flex" }}>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.95)", color: "#0f172a", fontSize: 34, padding: "8px 26px", borderRadius: 999 }}>
          Souq Autos
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: headingSize, lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden" }}>{card.heading}</div>
        <div style={{ display: "flex", fontSize: 34, color: "#e2e8f0", marginTop: 14, whiteSpace: "nowrap", overflow: "hidden" }}>{card.details}</div>
        <div style={{ display: "flex", marginTop: 26 }}>
          <div style={{ display: "flex", background: "white", color: "#0f172a", fontSize: 64, padding: "6px 34px", borderRadius: 18 }}>{card.price}</div>
        </div>
      </div>
    </div>
  );
}

async function produceShareImage(card: ShareCard, photo: Buffer | null): Promise<Buffer> {
  const overlay = Buffer.from(await new ImageResponse(overlayElement(card, photo !== null), { width: SHARE_WIDTH, height: SHARE_HEIGHT }).arrayBuffer());
  const base =
    photo ??
    (await sharp({ create: { width: SHARE_WIDTH, height: SHARE_HEIGHT, channels: 3, background: "#0f172a" } })
      .jpeg()
      .toBuffer());
  // Pas de `mozjpeg` : mesuré, il coûtait ~120 ms de plus (sur ~230) pour un poids à peine plus léger.
  return sharp(base).composite([{ input: overlay }]).jpeg({ quality: 82 }).toBuffer();
}

// Cache en mémoire, borné : une carte dépend UNIQUEMENT de son texte et de sa photo, donc la clé les contient — elle ne peut jamais
// servir une carte périmée, et n'a pas besoin de « date de modification » fiable. Les demandes simultanées d'une même carte
// (typique : un lien collé dans un groupe, que tous les téléphones prévisualisent en même temps) ne dessinent qu'une fois.
export const MAX_CACHED_IMAGES = 120;
const cache = new Map<string, Buffer>();
const inflight = new Map<string, Promise<Buffer>>();

export async function getShareImage(card: ShareCard, photoKey: string, loadPhoto: () => Promise<Buffer | null>): Promise<Buffer> {
  const key = JSON.stringify([card, photoKey]);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key); // ré-inséré en dernier : l'ordre d'une Map est l'ordre d'insertion, la plus ancienne sort la première
    cache.set(key, hit);
    return hit;
  }
  const running = inflight.get(key);
  if (running) return running;

  const promise = (async () => {
    const image = await produceShareImage(card, await loadPhoto());
    cache.set(key, image);
    while (cache.size > MAX_CACHED_IMAGES) cache.delete(cache.keys().next().value as string);
    return image;
  })().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

// Réservé aux tests : repart d'un cache vide.
export function clearShareImageCache(): void {
  cache.clear();
  inflight.clear();
}
