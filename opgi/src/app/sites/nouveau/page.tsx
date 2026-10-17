"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export default function NouveauSite() {
  const t = useTranslations("sites");
  const tc = useTranslations("commun");
  const [code, setCode] = useState("");
  const [nom, setNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, nom, adresse: adresse || null }),
      });
      if (res.ok) {
        window.location.assign("/sites");
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
    <main>
      <p>
        <Link href="/sites">{tc("retour")}</Link>
      </p>
      <h1>{t("nouveauTitre")}</h1>
      <form className="card" onSubmit={submit}>
        <label htmlFor="code">{t("code")}</label>
        <input id="code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={64} />

        <label htmlFor="nom">{t("nom")}</label>
        <input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} required maxLength={200} />

        <label htmlFor="adresse">{t("adresse")}</label>
        <input id="adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} maxLength={500} />

        <button type="submit" disabled={busy}>
          {busy ? tc("enregistrement") : tc("creer")}
        </button>
        {erreur && (
          <p className="erreur" role="alert">
            {erreur}
          </p>
        )}
      </form>
    </main>
  );
}
