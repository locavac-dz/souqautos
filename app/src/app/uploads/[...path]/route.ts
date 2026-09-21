import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { resolveUploadFile, uploadEtag, uploadsRoot } from "@/lib/uploads-serve";

// Lot 147 — sert les photos envoyées à `/uploads/<dossier>/<fichier>`. Voir src/lib/uploads-serve.ts : la version de production de Next.js
// ne sert pas les fichiers ajoutés à `public/` après son démarrage, et le site en ajoute à chaque photo envoyée.
//
// Un fichier de `public/uploads/` déjà présent au démarrage reste servi par Next.js lui-même, avant cette route : rien ne change pour lui.
// Cette route sert TOUT LE RESTE, et la seule adresse qu'elle sert est celle d'un vrai fichier d'un dossier que le site écrit.

// Toujours la même réponse pour tout ce qui n'est pas une photo servable : rien ne dit si le fichier existe, ou pourquoi il est refusé.
const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const root = uploadsRoot();
  const target = resolveUploadFile(root, segments);
  if (!target) return notFound();

  try {
    // Un lien symbolique posé dans le dossier ne doit jamais faire sortir de celui-ci : on compare les chemins RÉELS.
    const real = await realpath(target.file);
    const realRoot = await realpath(root);
    if (!real.startsWith(realRoot + path.sep)) return notFound();

    const info = await stat(real);
    if (!info.isFile()) return notFound();

    // Les noms de fichiers ne sont jamais réutilisés (UUID, src/lib/uploads.ts) : le navigateur peut garder la photo un an (Lot 135).
    const headers = {
      "Content-Type": target.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ETag: uploadEtag(info.size, info.mtimeMs),
    };
    if (request.headers.get("if-none-match") === headers.ETag) return new NextResponse(null, { status: 304, headers });

    const bytes = await readFile(real);
    return new NextResponse(new Uint8Array(bytes), { headers: { ...headers, "Content-Length": String(bytes.length) } });
  } catch {
    return notFound(); // fichier absent ou illisible
  }
}
