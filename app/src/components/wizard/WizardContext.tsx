"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { WizardData } from "./types";

const STORAGE_KEY = "souq-auto-wizard-draft";

type WizardContextValue = {
  data: WizardData;
  setData: (patch: Partial<WizardData>) => void;
  photos: File[];
  setPhotos: (files: File[]) => void;
  reset: () => void;
};

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [data, setDataState] = useState<WizardData>({});
  const [photos, setPhotos] = useState<File[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Les photos (File) ne sont pas persistées — seules les données de formulaire
  // survivent à une navigation entre étapes / un rechargement accidentel.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      // sessionStorage n'existe pas côté serveur : ce hydrate ne peut se faire
      // qu'après le montage, sous peine de désaccord SSR/client — d'où l'effet
      // plutôt qu'un lazy initializer dans useState.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setDataState(JSON.parse(stored));
    } catch {
      // stockage indisponible (navigation privée, etc.) — on continue sans persistance
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignoré
    }
  }, [data, hydrated]);

  const setData = useCallback((patch: Partial<WizardData>) => {
    setDataState((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setDataState({});
    setPhotos([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignoré
    }
  }, []);

  return (
    <WizardContext.Provider value={{ data, setData, photos, setPhotos, reset }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) {
    throw new Error("useWizard doit être utilisé dans un WizardProvider");
  }
  return ctx;
}
