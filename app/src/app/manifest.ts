import type { MetadataRoute } from "next";

// Lot 120 — manifeste de l'application installable (/manifest.webmanifest).
//
// Un seul manifeste pour les deux langues : `start_url: "/"` laisse le site choisir la langue
// du visiteur (comme à l'ouverture normale), et les raccourcis pointent vers des adresses sans
// préfixe de langue pour la même raison. Le nom reste « Souq Autos » dans les deux langues.
// Lot 269 (audit D2) — un manifeste ne peut pas être localisé par visiteur (Next n'en sert qu'un) : la description
// et les raccourcis sont bilingues, pour qu'un arabophone qui installe l'application ne lise pas que du français.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Souq Autos",
    short_name: "Souq Autos",
    description: "Le premier moteur de recherche automobile pensé pour l'Algérie · أول محرك بحث عن السيارات مصمّم للجزائر",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#12222e",
    lang: "fr",
    dir: "auto",
    categories: ["automotive", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Rechercher une voiture · البحث عن سيارة", short_name: "Rechercher · بحث", url: "/recherche" },
      { name: "Vendre mon véhicule · بيع مركبتي", short_name: "Vendre · بيع", url: "/vendre" },
      { name: "Essais auto · تجارب السيارات", short_name: "Essais · تجارب", url: "/essais" },
    ],
  };
}
