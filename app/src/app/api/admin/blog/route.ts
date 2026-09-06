import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { blogArticleSchema } from "@/lib/validation/blog";
import { slugify } from "@/lib/slugify";
import { generateUniqueSlug } from "@/lib/blog";
import { writeAuditLog } from "@/lib/audit-log";

// Réservé à ADMIN : le blog est un contenu public engageant l'image de la
// marque, pas une action de modération courante — même seuil que la gestion
// du référentiel marques/modèles.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = blogArticleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }
  const data = parsed.data;

  const existingSlugs = (await prisma.blogArticle.findMany({ select: { slug: true } })).map(
    (a) => a.slug
  );
  const slug = generateUniqueSlug(slugify(data.titleFr), existingSlugs);

  const article = await prisma.blogArticle.create({
    data: {
      slug,
      titleFr: data.titleFr,
      titleAr: data.titleAr,
      excerptFr: data.excerptFr,
      excerptAr: data.excerptAr,
      contentFr: data.contentFr,
      contentAr: data.contentAr,
      authorId: user.id,
      publishedAt: data.published ? new Date() : null,
    },
    select: { id: true, slug: true },
  });

  await writeAuditLog({
    adminId: user.id,
    action: "blog_article.create",
    targetType: "BlogArticle",
    targetId: article.id,
    details: { titleFr: data.titleFr, published: data.published },
  });

  return NextResponse.json({ article }, { status: 201 });
}
