import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-route";
import { isEditor } from "@/lib/auth-server/roles";
import { checkRateLimit } from "@/lib/rate-limit";
import { saveBlogCover, PhotoValidationError } from "@/lib/uploads";

// Lot 111 — envoi de la photo de couverture d'un essai. Réservé à ADMIN, comme
// le reste de la rubrique. L'article n'existe pas forcément encore (création) :
// ce point d'entrée ne touche donc à aucune ligne, il renvoie seulement
// l'adresse du fichier recadré, que le formulaire joint ensuite à l'article
// (revalidée alors par `isBlogCoverUrl`). Un envoi jamais rattaché à un article
// laisse un fichier orphelin : défaut mineur, volontairement toléré.
export async function POST(request: NextRequest) {
  const user = await requireRole(isEditor);
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`upload-blog-cover:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("cover");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  try {
    const coverImageUrl = await saveBlogCover(file);
    return NextResponse.json({ coverImageUrl });
  } catch (error) {
    if (error instanceof PhotoValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
