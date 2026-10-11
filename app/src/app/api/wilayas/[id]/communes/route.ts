import { NextRequest, NextResponse } from "next/server";
import { getSearchWilayas } from "@/lib/reference-data";
import { parsePositiveIntId } from "@/lib/validation/int-bounds";
import { apiHandler } from "@/lib/api-route";

// Lot 279 (audit C8) — communes d'une wilaya, chargées à la demande par les filtres de recherche au lieu d'être
// toutes envoyées au navigateur avec chaque page. Référentiel quasi immuable : cache public d'un jour.
const CACHE = { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" };

export const GET = apiHandler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id: rawId } = await params;
  const id = parsePositiveIntId(rawId);
  if (id === null) return NextResponse.json({ error: "validation" }, { status: 400 });

  const wilaya = (await getSearchWilayas()).find((w) => w.id === id);
  if (!wilaya) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json(
    { communes: wilaya.communes.map((c) => ({ id: c.id, nomFr: c.nomFr, nomAr: c.nomAr })) },
    { headers: CACHE }
  );
});
