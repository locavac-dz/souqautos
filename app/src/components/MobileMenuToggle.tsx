"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "@/i18n/navigation";

export function MobileMenuToggle({
  menuLabel,
  children,
}: {
  menuLabel: string;
  children: React.ReactNode;
}) {
  const panelId = useId();
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Le menu est ouvert « sur une page » : dès que la page change (le menu est dans la mise en page, qui n'est pas
  // remontée d'une page à l'autre), il se referme de lui-même au lieu de rester ouvert par-dessus la page choisie.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;

  // Un compte avec beaucoup d'entrées (équipe back-office) dépassait la hauteur de l'écran : il fallait faire
  // défiler la PAGE entière pour atteindre « Déconnexion », en bas de liste, confondu avec un bouton qui ne
  // répond pas. Le panneau défile maintenant lui-même, et la page derrière ne bouge plus tant qu'il est ouvert.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div
      className="sm:hidden"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpenedOn(null);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpenedOn(open ? null : pathname)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={menuLabel}
        className="rounded p-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
      >
        <span aria-hidden="true">{open ? "✕" : "☰"}</span>
      </button>
      {open && (
        <nav
          id={panelId}
          aria-label={menuLabel}
          className="absolute left-0 right-0 top-full z-40 flex max-h-[70vh] flex-col gap-3 overflow-y-auto border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm shadow-sm"
        >
          {children}
        </nav>
      )}
    </div>
  );
}
