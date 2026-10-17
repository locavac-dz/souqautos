"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

// Déconnexion de toutes les sessions (y compris la courante) : après succès, le
// cookie courant est effacé côté serveur → on redirige vers la connexion.
export function RevoquerSessions() {
  const t = useTranslations("compte");
  const tc = useTranslations("commun");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function revoquer() {
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/compte/sessions/revoquer", { method: "POST" });
      if (res.ok) {
        window.location.assign("/connexion");
        return;
      }
      setErreur(tc("erreur"));
    } catch {
      setErreur(tc("erreur"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>{t("sessionsTitre")}</h2>
      <p className="meta">{t("sessionsAide")}</p>
      <button type="button" onClick={revoquer} disabled={busy}>
        {busy ? tc("enregistrement") : t("revoquerTout")}
      </button>
      {erreur && (
        <p className="erreur" role="alert">
          {erreur}
        </p>
      )}
    </section>
  );
}
