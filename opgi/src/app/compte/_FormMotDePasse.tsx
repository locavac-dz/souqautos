"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

export function FormMotDePasse() {
  const t = useTranslations("compte");
  const tc = useTranslations("commun");
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setSucces(false);
    if (nouveau !== confirmation) {
      setErreur(t("nonConcordants"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/compte/motdepasse", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ancien, nouveau }),
      });
      if (res.ok) {
        setSucces(true);
        setAncien("");
        setNouveau("");
        setConfirmation("");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setErreur(body.error ?? tc("erreur"));
    } catch {
      setErreur(tc("erreur"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <label htmlFor="ancien">{t("ancien")}</label>
      <input
        id="ancien"
        type="password"
        autoComplete="current-password"
        value={ancien}
        onChange={(e) => setAncien(e.target.value)}
        required
      />

      <label htmlFor="nouveau">{t("nouveau")}</label>
      <input
        id="nouveau"
        type="password"
        autoComplete="new-password"
        value={nouveau}
        onChange={(e) => setNouveau(e.target.value)}
        required
      />

      <label htmlFor="confirmation">{t("confirmation")}</label>
      <input
        id="confirmation"
        type="password"
        autoComplete="new-password"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        required
      />

      <button type="submit" disabled={busy}>
        {busy ? tc("enregistrement") : t("changer")}
      </button>
      {succes && (
        <p className="succes" role="status">
          {t("succes")}
        </p>
      )}
      {erreur && (
        <p className="erreur" role="alert">
          {erreur}
        </p>
      )}
    </form>
  );
}
