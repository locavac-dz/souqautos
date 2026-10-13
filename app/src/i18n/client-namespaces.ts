// Lot 279 (audit C7) — espaces de noms i18n envoyés au navigateur.
//
// Avant ce lot, TOUT le catalogue (80 espaces de noms, 134 Ko FR / 159 Ko AR) était sérialisé dans chaque page
// pour NextIntlClientProvider. Seuls les espaces lus par `useTranslations("…")` ont besoin d'être côté client ;
// les composants serveur lisent le catalogue directement. Cette liste est le SUPERENSEMBLE des espaces nommés par
// un `useTranslations` quelque part dans src/ (un module sans « use client » peut être importé par un composant
// client) ; le test tests/i18n-client-namespaces.test.ts la recalcule depuis les sources et échoue si elle dérive.
export const CLIENT_NAMESPACES = [
  "Admin",
  "AdminBlog",
  "AdminCatalogue",
  "AdminGuide",
  "AdminOwnerReview",
  "AdminPaymentSettings",
  "AdminPayments",
  "AdminPressReview",
  "AdminProSubscriptionSettings",
  "AdminRoadTest",
  "AdminSettings",
  "AiAdvisor",
  "Alerts",
  "Auth",
  "BulkImport",
  "CallbackRequest",
  "Compare",
  "Contact",
  "EquipementSearch",
  "ErrorPage",
  "Estimate",
  "Groups",
  "Insurance",
  "IslamicFinancing",
  "LaunchNotice",
  "Listing",
  "ListingEdit",
  "Messages",
  "MyListings",
  "Nav",
  "Offer",
  "OwnerReview",
  "PasswordReset",
  "Payment",
  "PhotoGallery",
  "PreviewLinks",
  "PriceBadge",
  "Pro",
  "ProProspects",
  "ProfileEdit",
  "PushNotifications",
  "Pwa",
  "RecentlyViewed",
  "Report",
  "Review",
  "Search",
  "TrustScore",
  "TwoFactor",
  "Verification",
  "VisitRequest",
  "Wizard",
] as const;

export function pickClientMessages<T extends Record<string, unknown>>(messages: T): Partial<T> {
  const out: Partial<T> = {};
  for (const ns of CLIENT_NAMESPACES) {
    if (ns in messages) out[ns as keyof T] = messages[ns as keyof T];
  }
  return out;
}
