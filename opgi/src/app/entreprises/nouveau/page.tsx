"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export default function NouvelleEntreprise() {
  const t = useTranslations("entreprises");
  const tc = useTranslations("commun");
  const [raisonSociale, setRaisonSociale] = useState("");
  const [nif, setNif] = useState("");
  const [rc, setRc] = useState("");
  const [contact, setContact] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/entreprises", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ raisonSociale, nif: nif || null, rc: rc || null, contact: contact || null }),
      });
      if (res.ok) {
        window.location.assign("/entreprises");
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
        <Link href="/entreprises">{tc("retour")}</Link>
      </p>
      <h1>{t("nouveauTitre")}</h1>
      <form className="card" onSubmit={submit}>
        <label htmlFor="rs">{t("raisonSociale")}</label>
        <input id="rs" value={raisonSociale} onChange={(e) => setRaisonSociale(e.target.value)} required maxLength={300} />
        <label htmlFor="nif">{t("nif")}</label>
        <input id="nif" value={nif} onChange={(e) => setNif(e.target.value)} maxLength={50} />
        <label htmlFor="rc">{t("rc")}</label>
        <input id="rc" value={rc} onChange={(e) => setRc(e.target.value)} maxLength={50} />
        <label htmlFor="contact">{t("contact")}</label>
        <input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} />
        <button type="submit" disabled={busy}>{busy ? tc("enregistrement") : tc("creer")}</button>
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
      </form>
    </main>
  );
}
