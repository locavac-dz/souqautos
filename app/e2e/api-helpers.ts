import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { e2eDb, publishListing, uniquePhone } from "./db";
import { generateTestPhoto } from "./fixtures";

// Lot 131 — crée une annonce par l'API du site (comme le fait l'assistant de publication, sans ses 11 écrans, déjà
// couverts par listing-publish.spec.ts) pour les parcours qui ont seulement BESOIN d'une annonce.
// Le compte doit être connecté sur `page`. Le numéro de téléphone passe par l'API : c'est elle qui le chiffre.
export async function createListing(
  page: Page,
  options: { category?: string; brand?: string; model?: string; title?: string; price?: number; year?: number; wilayaId?: number; publish?: boolean } = {}
): Promise<{ id: string; title: string; phone: string }> {
  const model = await e2eDb().model.findFirstOrThrow({
    where: { name: options.model ?? "Clio", brand: { name: options.brand ?? "Renault" } },
    select: { id: true, brandId: true },
  });
  const title = options.title ?? `Renault Clio test bout en bout ${Date.now()}`;
  const phone = uniquePhone();

  const response = await page.request.post("/api/listings", {
    multipart: {
      data: JSON.stringify({
        category: options.category ?? "VOITURE",
        brandId: model.brandId,
        modelId: model.id,
        title,
        description: "Annonce créée par un test de bout en bout : véhicule bien entretenu, aucun accident, entretien à jour.",
        price: options.price ?? 1_900_000,
        year: options.year ?? 2019,
        mileage: 60000,
        fuelType: "DIESEL",
        gearbox: "MANUELLE",
        condition: "OCCASION",
        wilayaId: options.wilayaId ?? 16,
        phone,
        equipmentIds: [],
      }),
      photos: { name: "photo.jpg", mimeType: "image/jpeg", buffer: await generateTestPhoto() },
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const id = (await response.json()).listing.id as string;
  if (options.publish !== false) await publishListing(id);
  return { id, title, phone };
}
