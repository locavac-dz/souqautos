"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export default function NouveauProjet() {
  const t = useTranslations("projets");
  const tc = useTranslations("commun");
  const [code, setCode] = useState("");
  const [intitule, setIntitule] = useState("");
  const [programme, setProgramme] = useState("");
  const [source, setSource] = useState("");
  const [montant, setMontant] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/projets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          intitule,
          programme: programme || null,
          sourceFinancement: source || null,
          montantInitialCentimes: montant.trim() === "" ? null : Math.round(Number(montant) * 100),
        }),
      });
      if (res.ok) {
        window.location.assign("/projets");
        return;
      }
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setErreur(b.error ?? tc("erreur"));
    } catch {
      setErreur(tc("erreur"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <p>
        <Link href="/projets">{tc("retour")}</Link>
      </p>
      <h1>{t("nouveauTitre")}</h1>
      <form className="card" onSubmit={submit}>
        <label htmlFor="code">{t("code")}</label>
        <input id="code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={64} />
        <label htmlFor="intitule">{t("intitule")}</label>
        <input id="intitule" value={intitule} onChange={(e) => setIntitule(e.target.value)} required maxLength={300} />
        <label htmlFor="programme">{t("programme")}</label>
        <input id="programme" value={programme} onChange={(e) => setProgramme(e.target.value)} />
        <label htmlFor="source">{t("sourceFinancement")}</label>
        <input id="source" value={source} onChange={(e) => setSource(e.target.value)} />
        <label htmlFor="montant">{t("montantInitial")}</label>
        <input id="montant" type="number" min="0" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} />
        <button type="submit" disabled={busy}>{busy ? tc("enregistrement") : tc("creer")}</button>
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
      </form>
    </main>
  );
}
