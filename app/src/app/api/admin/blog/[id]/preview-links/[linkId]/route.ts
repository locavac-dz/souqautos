import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { writeAuditLog } from "@/lib/audit-log";
import { revokePreviewLink } from "@/lib/article-preview-links";

// Lot 146 — révoque un lien de relecture : il cesse de fonctionner immédiatement. Idempotent ; un lien qui n'appartient pas à ce
// contenu répond 404 comme un lien inexistant (on ne révoque jamais le lien d'un autre contenu par cette adresse).
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const admin = await getCurrentUser();
  if (!admin || !isAdmin(admin.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id, linkId } = await params;
  if (!(await revokePreviewLink(id, linkId))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await writeAuditLog({ adminId: admin.id, action: "article_preview_link.revoke", targetType: "BlogArticle", targetId: id, details: { linkId } });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
