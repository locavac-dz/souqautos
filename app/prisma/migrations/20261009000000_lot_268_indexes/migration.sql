-- Lot 268 (audit C10) — index manquants sur des filtres et tris réellement exécutés.

-- Filtre par wilaya seule (page /wilaya/[wilaya], recherche sans catégorie) : wilayaId n'était atteignable que derrière
-- category dans [status, category, wilayaId].
CREATE INDEX "Listing_status_wilayaId_publishedAt_idx" ON "Listing"("status", "wilayaId", "publishedAt" DESC);

-- Tri par prix (price_asc / price_desc) sur un filtre large.
CREATE INDEX "Listing_status_price_idx" ON "Listing"("status", "price");

-- Pagination curseur des messages directs (Lot 257) : conversationId + createdAt < curseur, tri décroissant.
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt" DESC);
