-- Lot 146 — liens d'aperçu d'un contenu non publié, pour un relecteur sans compte administrateur.
-- Le jeton n'est jamais stocké : seule son empreinte (HMAC) l'est.

-- CreateTable
CREATE TABLE "ArticlePreviewLink" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "ArticlePreviewLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArticlePreviewLink_tokenHash_key" ON "ArticlePreviewLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ArticlePreviewLink_articleId_idx" ON "ArticlePreviewLink"("articleId");

-- AddForeignKey
ALTER TABLE "ArticlePreviewLink" ADD CONSTRAINT "ArticlePreviewLink_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "BlogArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticlePreviewLink" ADD CONSTRAINT "ArticlePreviewLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
