"use client";

import { useCompare } from "./CompareContext";

export function CompareToggle({ listingId, label }: { listingId: string; label: string }) {
  const { isSelected, toggle, atMax } = useCompare();
  const selected = isSelected(listingId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(listingId);
      }}
      disabled={!selected && atMax}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center h-9 w-9 rounded-full border shadow-sm disabled:opacity-40 ${
        selected
          ? "bg-slate-900 border-slate-900 text-white"
          : "bg-white/90 border-slate-200 text-slate-500 hover:bg-white"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M4 6h16M4 12h16M4 18h7" strokeLinecap="round" />
        {selected && <path d="M17 15l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </button>
  );
}
