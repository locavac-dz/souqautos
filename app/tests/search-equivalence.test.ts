import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getLoadDatabaseUrl } from "../scripts/load-database";
import { buildListingWhere } from "@/lib/search";
import { matchCatalogue } from "@/lib/search-query";
import { searchParamsSchema } from "@/lib/validation/search";

// Lot 139 — la recherche par mot « rapide » (mot cherché d'abord dans le catalogue, requête sans jointure) trouve EXACTEMENT ce que
// trouvait l'ancienne forme (jointures vers marque, modèle, wilaya). C'est la preuve qui compte : une optimisation qui change les
// résultats n'est pas une optimisation. Comparaison sur la base de test de charge (jusqu'à 100 000 annonces fabriquées, `npm run
// load:seed`) : les annonces retrouvées sont comparées une à une (empreinte de la liste triée de leurs identifiants), pas seulement
// comptées. Se SAUTE si cette base n'existe pas ou est vide.
let prisma: PrismaClient | null = null;
let ready = false;
let brands: { id: number; name: string; models: { id: number; name: string }[] }[] = [];
let wilayas: { id: number; nomFr: string; nomAr: string }[] = [];

beforeAll(async () => {
  try {
    prisma = new PrismaClient({ datasourceUrl: getLoadDatabaseUrl() });
    ready = (await prisma.listing.count({ where: { status: "PUBLIEE" } })) >= 1000;
    if (ready) {
      brands = await prisma.brand.findMany({ include: { models: { select: { id: true, name: true } } } });
      wilayas = await prisma.wilaya.findMany({ select: { id: true, nomFr: true, nomAr: true } });
    }
  } catch {
    ready = false;
  }
});
afterAll(async () => {
  await prisma?.$disconnect();
});

const fingerprint = (ids: string[]) => createHash("sha1").update([...ids].sort().join(",")).digest("hex");

async function compare(input: Record<string, unknown>) {
  const params = searchParamsSchema.parse(input);
  const reference = await prisma!.listing.findMany({ where: buildListingWhere(params), select: { id: true } });
  const fast = await prisma!.listing.findMany({ where: buildListingWhere(params, matchCatalogue(params.q ?? "", brands, wilayas)), select: { id: true } });
  const counted = await prisma!.listing.count({ where: buildListingWhere(params, matchCatalogue(params.q ?? "", brands, wilayas)) });
  return { reference: reference.map((l) => l.id), fast: fast.map((l) => l.id), counted };
}

const WORDS = [
  "clio", "CLIO", "Clio", "cLiO", "golf", "renault", "RENAULT", "peugeot", "dacia", "hyundai",
  "alger", "ALGER", "Alger", "oran", "constantine", "blida", "sétif", "tizi",
  "2019", "2005", "16", "renault clio", "clio 2019", "première main", "full option", "climatisée", "état neuf",
  "mt-07", "kangoo", "a", "e", "o", "ar", "io", "é", "ée", "ç",
  "%", "_", "%_", "50%", "\\", "'", '"', ";--", "clio'", "\\clio",
  // Jokers de LIKE : Prisma ne les protège pas, donc « c_io » trouve « Clio ». Le titre des annonces contient toujours le nom du
  // modèle et masquerait un écart : c'est le test « catalogue » ci-dessous qui les vérifie contre PostgreSQL.
  "c_io", "cl_o", "C%O", "r%t", "_lio", "clio_", "a%a%a", "\\%", "\\_", "cl\\", "k__go", "%r%n%", "d_c_a", "al%r", "___",
  "الجزائر", "وهران", "قسنطينة", "ا", "ال",
  "zzzz", "xyzxyz", "ferrari",
];

describe("recherche par mot : la forme rapide trouve exactement ce que trouvait l'ancienne", () => {
  it.each(WORDS)("« %s » : mêmes annonces, une à une", async (word) => {
    if (!ready) return; // base de charge absente : voir l'en-tête (se saute)
    const { reference, fast, counted } = await compare({ q: word });
    expect(fast.length, `nombre d'annonces pour « ${word} »`).toBe(reference.length);
    expect(counted, "le comptage de la pagination").toBe(reference.length);
    expect(fingerprint(fast)).toBe(fingerprint(reference));
  }, 60_000);

  it.each([
    { q: "clio", category: "VOITURE", wilayaId: "16" },
    { q: "golf", fuelType: "DIESEL", priceMax: "2500000" },
    { q: "alger", yearMin: "2018", gearbox: "AUTOMATIQUE" },
    { q: "renault", brandId: "1" },
  ])("mot + filtres %j : mêmes annonces", async (input) => {
    if (!ready) return;
    const { reference, fast } = await compare(input);
    expect(fingerprint(fast)).toBe(fingerprint(reference));
    expect(fast.length).toBe(reference.length);
  }, 60_000);

  // Le titre des annonces fabriquées contient toujours le nom du modèle : il MASQUERAIT un écart entre la recherche du mot dans le
  // catalogue (en mémoire) et celle de PostgreSQL. On compare donc le catalogue directement, mot par mot, sans passer par les annonces.
  it.each(WORDS)("catalogue « %s » : mêmes marques, modèles et wilayas que PostgreSQL", async (word) => {
    if (!ready) return;
    const contains = { contains: word, mode: "insensitive" } as const;
    const expectedBrands = (await prisma!.brand.findMany({ where: { name: contains }, select: { id: true } })).map((b) => b.id);
    const expectedModels = (await prisma!.model.findMany({ where: { name: contains }, select: { id: true } })).map((m) => m.id);
    const expectedWilayas = (await prisma!.wilaya.findMany({ where: { OR: [{ nomFr: contains }, { nomAr: contains }] }, select: { id: true } })).map((w) => w.id);
    const got = matchCatalogue(word, brands, wilayas);
    expect([...got.brandIds].sort((a, b) => a - b)).toEqual(expectedBrands.sort((a, b) => a - b));
    expect([...got.modelIds].sort((a, b) => a - b)).toEqual(expectedModels.sort((a, b) => a - b));
    expect([...got.wilayaIds].sort((a, b) => a - b)).toEqual(expectedWilayas.sort((a, b) => a - b));
  });

  it("le corpus est assez varié pour mériter ce nom : mots courants, précis, sans résultat, accents et arabe trouvent des choses différentes", async () => {
    if (!ready) return;
    const sizes = new Map<string, number>();
    for (const word of ["clio", "alger", "zzzz", "الجزائر", "%"]) sizes.set(word, (await compare({ q: word })).reference.length);
    expect(sizes.get("clio")!).toBeGreaterThan(1000); // très courant
    expect(sizes.get("alger")!).toBeGreaterThan(1000); // par la wilaya
    expect(sizes.get("zzzz")).toBe(0); // rien
    expect(sizes.get("الجزائر")!).toBeGreaterThan(1000); // par le NOM ARABE de la wilaya (aucune annonce ne porte ce mot dans son titre)
    expect(sizes.get("%")).toBeGreaterThan(50_000); // « % » est un joker : il trouve tout, comme avant (Prisma ne le protège pas)
  }, 120_000);
});
