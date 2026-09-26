import type { MetadataRoute } from "next";

// Lot 120 — manifeste de l'application installable (/manifest.webmanifest).
//
// Un seul manifeste pour les deux langues : `start_url: "/"` laisse le site choisir la langue
// du visiteur (comme à l'ouverture normale), et les raccourcis pointent vers des adresses sans
// préfixe de langue pour la même raison. Le nom reste « Souq Auto » dans les deux langues.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Souq Auto",
    short_name: "Souq Auto",
    description: "Le premier moteur de recherche automobile pensé pour l'Algérie.",
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
      { src: "/icons/icon-maskable-512.png", sizes: "192x192 512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Rechercher une voiture", short_name: "Rechercher", url: "/recherche" },
      { name: "Vendre mon véhicule", short_name: "Vendre", url: "/vendre" },
      { name: "Essais auto", short_name: "Essais", url: "/essais" },
    ],
  };
}
