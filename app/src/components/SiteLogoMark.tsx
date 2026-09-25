// Symbole de marque « Double Anneau » — deux arcs décalés, lus comme une
// jante de loin ou comme un accord conclu entre deux parties de près.
// Retenu par le porteur de projet parmi trois pistes proposées (2026-09-05).
export function SiteLogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="26" cy="32" r="18" fill="none" stroke="#059669" strokeWidth="6.5" />
      <circle cx="40" cy="32" r="18" fill="none" stroke="#0ea5e9" strokeWidth="6.5" />
    </svg>
  );
}
