import type { Prisma } from "@prisma/client";
import { getSearchBrands, getSearchWilayas } from "@/lib/reference-data";
import { buildListingWhere, type CatalogueMatches } from "@/lib/search";
import { containsInsensitive } from "@/lib/like";
import type { SearchParams } from "@/lib/validation/search";

// Lot 139 — recherche par mot rapide À VOLUME ÉLEVÉ, sans changer ce qu'elle trouve.
//
// « renault » ou « alger » cherche dans le titre, dans les textes libres de marque et de modèle, ET dans le NOM de la marque, du
// modèle et de la wilaya de chaque annonce. Ces trois derniers étaient testés par des jointures (une ligne d'annonce = jusqu'à
// quatre tables à joindre) : le comptage de la pagination lisait toute la table et faisait ces jointures pour chaque ligne
// (mesuré : 123 à 292 ms à 100 000 annonces, et 408 ms pour un mot sans résultat).
//
// Les marques, modèles et wilayas sont quelques centaines de lignes, déjà gardées en mémoire (src/lib/reference-data.ts) : on
// cherche le mot DANS CES LISTES d'abord, et la requête devient « titre contient le mot OU marque dans (…) OU modèle dans (…) OU
// wilaya dans (…) » — sans jointure, et le titre et les textes libres sont couverts par les index trigramme (migration
// listing_text_search). La condition est équivalente à l'ancienne : tests/search-query-equivalence.test.ts compare, sur une
// base de 100 000 annonces, les résultats des deux formes.

type CatalogueBrand = { id: number; name: string; models: { id: number; name: string }[] };
type CatalogueWilaya = { id: number; nomFr: string; nomAr: string };

// « Contient, sans tenir compte de la casse » EXACTEMENT comme `ILIKE '%mot%'` de l'ancienne forme, jokers compris (src/lib/like.ts) :
// Prisma ne protège pas « % » ni « _ », donc « c_io » trouvait le modèle « Clio ». Aucun pliage des accents, dans un cas comme dans l'autre.
export function matchCatalogue(q: string, brands: readonly CatalogueBrand[], wilayas: readonly CatalogueWilaya[]): CatalogueMatches {
  const brandIds: number[] = [];
  const modelIds: number[] = [];
  for (const brand of brands) {
    if (containsInsensitive(brand.name, q)) brandIds.push(brand.id);
    for (const model of brand.models) if (containsInsensitive(model.name, q)) modelIds.push(model.id);
  }
  const wilayaIds = wilayas.filter((w) => containsInsensitive(w.nomFr, q) || containsInsensitive(w.nomAr, q)).map((w) => w.id);
  return { brandIds, modelIds, wilayaIds };
}

// La condition de recherche prête à l'emploi : sans mot, exactement l'ancienne ; avec un mot, la forme sans jointure.
export async function resolveListingWhere(params: SearchParams): Promise<Prisma.ListingWhereInput> {
  if (!params.q) return buildListingWhere(params);
  const [brands, wilayas] = await Promise.all([getSearchBrands(), getSearchWilayas()]);
  return buildListingWhere(params, matchCatalogue(params.q, brands, wilayas));
}
