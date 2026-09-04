"use client";

import { useState } from "react";

export function MobileMenuToggle({
  menuLabel,
  children,
}: {
  menuLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={menuLabel}
        className="rounded p-2 text-slate-700 hover:text-slate-900"
      >
        {open ? "✕" : "☰"}
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-40 flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          {children}
        </div>
      )}
    </div>
  );
}
