import type { Metadata } from "next";

// Espace personnel : aucune page n'est indexable, quel que soit ce que déclare la page elle-même.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function CompteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
