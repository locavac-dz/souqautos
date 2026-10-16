"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

const TYPES = ["LOGEMENT", "LOCAL_COMMERCIAL", "GARAGE", "AUTRE"] as const;
const ETATS = ["VACANT", "OCCUPE", "INDISPONIBLE"] as const;

export default function NouveauBien() {
  const t = useTranslations("patrimoine");
  const tc = useTranslations("commun");
  const [code, setCode] = useState("");
  const [type, setType] = useState<string>("LOGEMENT");
  const [etat, setEtat] = useState<string>("VACANT");
  const [adresse, setAdresse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/biens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, type, etatOccupation: etat, adresse: adresse || null }),
      });
      if (res.ok) {
        window.location.assign("/patrimoine");
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
        <Link href="/patrimoine">{tc("retour")}</Link>
      </p>
      <h1>{t("nouveauTitre")}</h1>
      <form className="card" onSubmit={submit}>
        <label htmlFor="code">{t("code")}</label>
        <input id="code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={64} />

        <label htmlFor="type">{t("type")}</label>
        <select id="type" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((v) => (
            <option key={v} value={v}>
              {t(`type${v}`)}
            </option>
          ))}
        </select>

        <label htmlFor="etat">{t("etat")}</label>
        <select id="etat" value={etat} onChange={(e) => setEtat(e.target.value)}>
          {ETATS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

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
