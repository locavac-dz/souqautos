import { articleStatus } from "@/lib/blog-publication";
import { listPreviewLinks, previewLinkState } from "@/lib/article-preview-links";
import { PreviewLinksManager, type PreviewLinkRow } from "@/components/admin/PreviewLinksManager";

// Lot 146 — enveloppe serveur partagée par les pages d'édition d'un article, d'un essai et d'un guide : ne s'affiche que pour un contenu
// NON publié (un contenu paru est public, un lien de relecture n'aurait aucun sens), et ne transmet jamais de jeton (il n'est pas stocké).
export async function PreviewLinksSection({ articleId, publishedAt }: { articleId: string; publishedAt: Date | null }) {
  const now = new Date();
  if (articleStatus(publishedAt, now) === "published") return null;

  const links: PreviewLinkRow[] = (await listPreviewLinks(articleId)).map((link) => ({
    id: link.id,
    createdAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt.toISOString(),
    revokedAt: link.revokedAt?.toISOString() ?? null,
    lastUsedAt: link.lastUsedAt?.toISOString() ?? null,
    createdBy: link.createdBy.email,
    state: previewLinkState(link, now),
  }));
  return <PreviewLinksManager articleId={articleId} links={links} />;
}
