import type { Metadata } from "next";

// Espace du compte professionnel (tableau de bord, prospects, statistiques, import) : jamais indexé.
// La vitrine publique pro/[id] reste hors de ce groupe.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ProPriveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
