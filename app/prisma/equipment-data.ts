// Référentiel des équipements — Lot 72, comble l'écart documenté depuis le
// Lot 4/45 (docs/ARCHITECTURE.md §14). Volontairement limité à des options
// réellement courantes sur un véhicule d'occasion vendu en Algérie (pas de
// fonctionnalité exotique/fabriquée) ; à enrichir progressivement au fil des
// prochains lots, même discipline que catalogue-data.ts.

export type EquipmentCategoryKey = "CONFORT" | "SECURITE" | "MULTIMEDIA" | "EXTERIEUR" | "ACCESSOIRE";

export const equipmentCatalogue: {
  slug: string;
  nameFr: string;
  nameAr: string;
  category: EquipmentCategoryKey;
}[] = [
  // Confort
  { slug: "climatisation", nameFr: "Climatisation", nameAr: "تكييف", category: "CONFORT" },
  { slug: "climatisation-automatique", nameFr: "Climatisation automatique", nameAr: "تكييف أوتوماتيكي", category: "CONFORT" },
  { slug: "vitres-electriques", nameFr: "Vitres électriques", nameAr: "نوافذ كهربائية", category: "CONFORT" },
  { slug: "toit-ouvrant", nameFr: "Toit ouvrant", nameAr: "سقف قابل للفتح", category: "CONFORT" },
  { slug: "sieges-chauffants", nameFr: "Sièges chauffants", nameAr: "مقاعد مدفأة", category: "CONFORT" },
  { slug: "sieges-cuir", nameFr: "Sièges cuir", nameAr: "مقاعد جلدية", category: "CONFORT" },
  { slug: "regulateur-vitesse", nameFr: "Régulateur de vitesse", nameAr: "منظم السرعة", category: "CONFORT" },

  // Sécurité
  { slug: "abs", nameFr: "ABS", nameAr: "نظام ABS", category: "SECURITE" },
  { slug: "airbags-multiples", nameFr: "Airbags multiples", nameAr: "وسائد هوائية متعددة", category: "SECURITE" },
  { slug: "camera-recul", nameFr: "Caméra de recul", nameAr: "كاميرا خلفية", category: "SECURITE" },
  { slug: "capteurs-stationnement", nameFr: "Capteurs de stationnement", nameAr: "حساسات الوقوف", category: "SECURITE" },
  { slug: "freinage-urgence", nameFr: "Système de freinage d'urgence", nameAr: "نظام الفرملة الطارئة", category: "SECURITE" },

  // Multimédia
  { slug: "bluetooth", nameFr: "Bluetooth", nameAr: "بلوتوث", category: "MULTIMEDIA" },
  { slug: "gps", nameFr: "GPS / Navigation", nameAr: "نظام تحديد المواقع GPS", category: "MULTIMEDIA" },
  { slug: "ecran-tactile", nameFr: "Écran tactile", nameAr: "شاشة لمس", category: "MULTIMEDIA" },
  { slug: "audio-premium", nameFr: "Système audio premium", nameAr: "نظام صوت متطور", category: "MULTIMEDIA" },

  // Extérieur
  { slug: "jantes-alliage", nameFr: "Jantes alliage", nameAr: "جنوط ألمنيوم", category: "EXTERIEUR" },
  { slug: "barres-toit", nameFr: "Barres de toit", nameAr: "حاملات السقف", category: "EXTERIEUR" },
  { slug: "retroviseurs-electriques", nameFr: "Rétroviseurs électriques", nameAr: "مرايا كهربائية", category: "EXTERIEUR" },
  { slug: "phares-led", nameFr: "Phares LED", nameAr: "مصابيح LED", category: "EXTERIEUR" },

  // Accessoires / remorquage / transport
  { slug: "attelage-remorque", nameFr: "Attelage remorque", nameAr: "خطاف مقطورة", category: "ACCESSOIRE" },
  { slug: "coffre-de-toit", nameFr: "Coffre de toit", nameAr: "صندوق سقف", category: "ACCESSOIRE" },
  { slug: "porte-velo", nameFr: "Porte-vélo", nameAr: "حامل دراجات", category: "ACCESSOIRE" },
  { slug: "galerie-de-toit", nameFr: "Galerie de toit", nameAr: "رف السقف", category: "ACCESSOIRE" },
  { slug: "porte-ski", nameFr: "Porte-ski", nameAr: "حامل تزلج", category: "ACCESSOIRE" },
];
