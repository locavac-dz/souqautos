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
  // Lot 44 — brouillon persistant en base (au-delà de sessionStorage, perdu à
  // la fermeture du navigateur) : vrai seulement si l'état initial vient du
  // serveur plutôt que d'une session locale déjà active, pour afficher un
  // avis « brouillon repris » une seule fois au démarrage.
  resumedFromServer: boolean;
  draftUpdatedAt: string | null;
  // Checkpoint explicite, appelé à chaque transition d'étape validée (jamais
  // à chaque frappe clavier comme sessionStorage) — évite de spammer l'API.
  syncDraft: () => void;
};

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [data, setDataState] = useState<WizardData>({});
  const [photos, setPhotos] = useState<File[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [resumedFromServer, setResumedFromServer] = useState(false);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);

  // Les photos (File) ne sont pas persistées — seules les données de formulaire
  // survivent à une navigation entre étapes / un rechargement accidentel.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setDataState(JSON.parse(stored));
    } catch {
      // stockage indisponible (navigation privée, etc.) — on continue sans persistance
    }

    if (stored) {
      // Session locale déjà active (onglet jamais fermé) — pas besoin d'aller
      // chercher un brouillon serveur potentiellement plus ancien.
      setHydrated(true);
      return;
    }

    // Rien en sessionStorage : soit un premier passage, soit une reprise après
    // fermeture complète du navigateur (§ « brouillon persistant multi-session »,
    // Lot 2/22) — on vérifie s'il existe un brouillon côté serveur.
    fetch("/api/listings/draft")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { draft: { data: WizardData; updatedAt: string } | null } | null) => {
        if (body?.draft) {
          setDataState(body.draft.data);
          setResumedFromServer(true);
          setDraftUpdatedAt(body.draft.updatedAt);
        }
      })
      .catch(() => {
        // Hors ligne ou erreur réseau — l'assistant reste utilisable, juste
        // sans reprise possible pour cette visite.
      })
      .finally(() => setHydrated(true));
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

  const syncDraft = useCallback(() => {
    fetch("/api/listings/draft", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    }).catch(() => {
      // Best effort — sessionStorage reste la sauvegarde de premier niveau
      // pour la session en cours, même si la synchronisation serveur échoue.
    });
  }, [data]);

  const reset = useCallback(() => {
    setDataState({});
    setPhotos([]);
    setResumedFromServer(false);
    setDraftUpdatedAt(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignoré
    }
    fetch("/api/listings/draft", { method: "DELETE" }).catch(() => {});
  }, []);

  return (
    <WizardContext.Provider
      value={{ data, setData, photos, setPhotos, reset, resumedFromServer, draftUpdatedAt, syncDraft }}
    >
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
