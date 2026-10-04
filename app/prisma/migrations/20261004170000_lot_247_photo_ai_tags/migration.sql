-- Lot 247 — Analyse photo IA (V3) : tags Claude Vision par photo d'annonce.
-- aiTags : JSON sérialisé de PhotoAiTag (subject, hasWatermark, isProfessionalStock, note).
-- null tant que la photo n'a pas encore été analysée (ANTHROPIC_API_KEY absent
-- ou appel échoué) — jamais une chaîne vide ni une valeur inventée.
ALTER TABLE "ListingPhoto" ADD COLUMN "aiTags" TEXT;
