"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

const CATEGORIES = ["PLOMBERIE", "ELECTRICITE", "MACONNERIE", "ASCENSEUR", "CHAUFFAGE", "PROPRETE", "AUTRE"] as const;
const URGENCES = ["FAIBLE", "NORMALE", "HAUTE", "CRITIQUE"] as const;

export default function NouvelleReclamation() {
  const t = useTranslations("reclamations");
  const tc = useTranslations("commun");
  const [categorie, setCategorie] = useState<string>("PLOMBERIE");
  const [urgence, setUrgence] = useState<string>("NORMALE");
  const [description, setDescription] = useState("");
  const [localisation, setLocalisation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/reclamations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categorie, urgence, description, localisation: localisation || null }),
      });
      if (res.ok) {
        window.location.assign("/reclamations");
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
        <Link href="/reclamations">{tc("retour")}</Link>
      </p>
      <h1>{t("nouveauTitre")}</h1>
      <form className="card" onSubmit={submit}>
        <label htmlFor="categorie">{t("categorie")}</label>
        <select id="categorie" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
          {CATEGORIES.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <label htmlFor="urgence">{t("urgence")}</label>
        <select id="urgence" value={urgence} onChange={(e) => setUrgence(e.target.value)}>
          {URGENCES.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <label htmlFor="description">{t("description")}</label>
        <input id="description" value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={5000} />

        <label htmlFor="localisation">{t("localisation")}</label>
        <input id="localisation" value={localisation} onChange={(e) => setLocalisation(e.target.value)} maxLength={300} />

        <button type="submit" disabled={busy}>{busy ? tc("enregistrement") : t("creer")}</button>
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
      </form>
    </main>
  );
}
