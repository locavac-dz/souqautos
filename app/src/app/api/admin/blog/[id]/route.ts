import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { blogArticleSchema } from "@/lib/validation/blog";
import { writeAuditLog } from "@/lib/audit-log";

// Le slug n'est jamais recalculé à l'édition — une fois publié, son URL doit
// rester stable (référencement, liens déjà partagés), même si le titre change.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = blogArticleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }
  const data = parsed.data;

  const article = await prisma.blogArticle.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // publishedAt ne bouge que sur une vraie transition d'état (jamais republié
  // à chaque simple correction de texte, jamais réinitialisé à mi-parcours).
  let publishedAt = article.publishedAt;
  if (data.published && !article.publishedAt) {
    publishedAt = new Date();
  } else if (!data.published) {
    publishedAt = null;
  }

  await prisma.blogArticle.update({
    where: { id },
    data: {
      titleFr: data.titleFr,
      titleAr: data.titleAr,
      excerptFr: data.excerptFr,
      excerptAr: data.excerptAr,
      contentFr: data.contentFr,
      contentAr: data.contentAr,
      publishedAt,
    },
  });

  await writeAuditLog({
    adminId: user.id,
    action: "blog_article.update",
    targetType: "BlogArticle",
    targetId: id,
    details: { titleFr: data.titleFr, published: Boolean(publishedAt) },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const article = await prisma.blogArticle.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.blogArticle.delete({ where: { id } });

  await writeAuditLog({
    adminId: user.id,
    action: "blog_article.delete",
    targetType: "BlogArticle",
    targetId: id,
    details: { titleFr: article.titleFr },
  });

  return NextResponse.json({ ok: true });
}
