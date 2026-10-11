-- CHECK constraints — filet de sécurité au niveau base de données.
-- Chaque contrainte doublonne une validation Zod côté application, mais protège
-- contre les insertions directes, les migrations de données et les régressions.

-- ═══ CRITICAL : montants financiers ═══

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_price_positive" CHECK (price > 0 AND price <= 999999999);

ALTER TABLE "PaymentOrder"
  ADD CONSTRAINT "PaymentOrder_amount_positive" CHECK ("amountDzd" > 0);

ALTER TABLE "ProSubscriptionOrder"
  ADD CONSTRAINT "ProSubscriptionOrder_amount_positive" CHECK ("amountDzd" > 0);

ALTER TABLE "Offer"
  ADD CONSTRAINT "Offer_amount_range" CHECK (amount >= 1 AND amount <= 1000000000);

ALTER TABLE "Offer"
  ADD CONSTRAINT "Offer_counterAmount_range" CHECK ("counterAmount" IS NULL OR ("counterAmount" >= 1 AND "counterAmount" <= 1000000000));

ALTER TABLE "ListingPriceHistory"
  ADD CONSTRAINT "ListingPriceHistory_price_positive" CHECK (price > 0);

-- ═══ HIGH : notes et évaluations ═══

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_rating_range" CHECK (rating >= 1 AND rating <= 5);

ALTER TABLE "OwnerReview"
  ADD CONSTRAINT "OwnerReview_rating_range" CHECK (rating >= 1 AND rating <= 5);

-- ═══ HIGH : caractéristiques véhicule ═══

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_year_range" CHECK (year >= 1970 AND year <= 2100);

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_mileage_range" CHECK (mileage IS NULL OR (mileage >= 0 AND mileage <= 2000000));

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_fraudScore_range" CHECK ("fraudScore" >= 0 AND "fraudScore" <= 100);

-- ═══ MEDIUM : compteurs et caractéristiques secondaires ═══

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_views_non_negative" CHECK (views >= 0);

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_doors_range" CHECK (doors IS NULL OR (doors >= 1 AND doors <= 7));

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_seats_range" CHECK (seats IS NULL OR (seats >= 1 AND seats <= 9));

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_powerHp_range" CHECK ("powerHp" IS NULL OR ("powerHp" >= 1 AND "powerHp" <= 2000));

ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_fiscalPower_range" CHECK ("fiscalPower" IS NULL OR ("fiscalPower" >= 1 AND "fiscalPower" <= 99));

ALTER TABLE "User"
  ADD CONSTRAINT "User_failedLoginAttempts_non_negative" CHECK ("failedLoginAttempts" >= 0);

ALTER TABLE "OwnerReview"
  ADD CONSTRAINT "OwnerReview_purchaseYear_range" CHECK ("purchaseYear" IS NULL OR ("purchaseYear" >= 1990 AND "purchaseYear" <= 2100));

ALTER TABLE "OwnerReview"
  ADD CONSTRAINT "OwnerReview_mileageKm_range" CHECK ("mileageKm" IS NULL OR ("mileageKm" >= 0 AND "mileageKm" <= 1000000));
