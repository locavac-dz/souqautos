import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiHandler, NO_STORE, parseJsonBody, requireRole } from "@/lib/api-route";
import { isEditor } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { articlePublicPath } from "@/lib/blog";
import { articleStatus } from "@/lib/blog-publication";
import { TooManyPreviewLinksError, createPreviewLink, listPreviewLinks, parsePreviewDays, previewLinkState } from "@/lib/article-preview-links";

// Lot 146 — liens de relecture d'un contenu non publié. Réservé aux ADMINISTRATEURS : c'est le droit d'éditer ce contenu, et un lien
// donne à quelqu'un d'autre le droit de le LIRE avant sa parution. Aucune réponse de cette route n'est mise en cache.
const bodySchema = z.object({ days: z.number() });

export const GET = apiHandler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireRole(isEditor);
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  if (!(await prisma.blogArticle.findUnique({ where: { id }, select: { id: true } }))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const now = new Date();
  const links = (await listPreviewLinks(id)).map((link) => ({
    id: link.id,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    revokedAt: link.revokedAt,
    lastUsedAt: link.lastUsedAt,
    createdBy: link.createdBy.email,
    state: previewLinkState(link, now),
  }));
  return NextResponse.json({ links }, { headers: NO_STORE });
});

export const POST = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireRole(isEditor);
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;

  const body = await parseJsonBody(request, bodySchema);
  const days = body instanceof NextResponse ? null : parsePreviewDays(body.days);
  if (days === null) return NextResponse.json({ error: "validation" }, { status: 400 });

  const article = await prisma.blogArticle.findUnique({ where: { id }, select: { id: true, kind: true, slug: true, publishedAt: true } });
  if (!article) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Un contenu DÉJÀ paru est public : un lien de relecture n'aurait aucun sens, et donnerait un faux sentiment de confidentialité.
  if (articleStatus(article.publishedAt, new Date()) === "published") return NextResponse.json({ error: "already_published" }, { status: 409 });

  try {
    const { token, link } = await createPreviewLink({ articleId: article.id, adminId: admin.id, days });
    await writeAuditLog({
      adminId: admin.id,
      action: "article_preview_link.create",
      targetType: "BlogArticle",
      targetId: article.id,
      // Jamais le jeton ni son empreinte dans le journal : seulement de quoi retrouver QUEL lien, créé quand, valable combien de temps.
      details: { linkId: link.id, days, expiresAt: link.expiresAt.toISOString() },
    });

    const path = articlePublicPath(article.kind, article.slug);
    // Le jeton n'est renvoyé QU'ICI, une seule fois : il n'existe nulle part ailleurs.
    return NextResponse.json(
      { token, link: { id: link.id, createdAt: link.createdAt, expiresAt: link.expiresAt }, paths: { fr: `/fr${path}?apercu=${token}`, ar: `/ar${path}?apercu=${token}` } },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof TooManyPreviewLinksError) return NextResponse.json({ error: "too_many" }, { status: 409 });
    throw error;
  }
});
