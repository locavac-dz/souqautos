"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { MAX_COMPARE, toggleCompareId } from "@/lib/compare";

const STORAGE_KEY = "souq-auto-compare";

type CompareContextValue = {
  ids: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
  atMax: boolean;
};

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Hydrate depuis localStorage après montage seulement (indisponible côté
      // serveur, évite un désaccord SSR/client) — même raison que WizardContext.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setIds(JSON.parse(stored));
    } catch {
      // ignoré
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // ignoré
    }
  }, [ids, hydrated]);

  const isSelected = useCallback((id: string) => ids.includes(id), [ids]);

  const toggle = useCallback((id: string) => {
    setIds((prev) => toggleCompareId(prev, id));
  }, []);

  const clear = useCallback(() => setIds([]), []);

  return (
    <CompareContext.Provider value={{ ids, isSelected, toggle, clear, atMax: ids.length >= MAX_COMPARE }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare doit être utilisé dans un CompareProvider");
  return ctx;
}
