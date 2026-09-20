import { notFound } from "next/navigation";

// Lot 131 — toute adresse qui ne correspond à aucune page (/fr/nimporte-quoi) passe par ici pour afficher la page
// « introuvable » traduite de [locale]/not-found.tsx. Sans cette route, seule la page anglaise par défaut de Next.js
// est possible. Les vraies pages, plus précises, sont toujours servies en priorité.
export default function UnknownPage() {
  notFound();
}
