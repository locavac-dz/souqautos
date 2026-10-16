"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

interface Option {
  id: string;
  label: string;
}

export function FormMarche({ projets, entreprises }: { projets: Option[]; entreprises: Option[] }) {
  const t = useTranslations("marches");
  const tc = useTranslations("commun");
  const [reference, setReference] = useState("");
  const [projetId, setProjetId] = useState(projets[0]?.id ?? "");
  const [entrepriseId, setEntrepriseId] = useState(entreprises[0]?.id ?? "");
  const [objet, setObjet] = useState("");
  const [montant, setMontant] = useState("");
  const [dateNotification, setDateNotification] = useState("");
  const [delai, setDelai] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/marches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reference,
          projetId,
          entrepriseId,
          objet,
          montantCentimes: Math.round(Number(montant) * 100),
          dateNotification: dateNotification || null,
          delaiJours: delai.trim() === "" ? null : Number(delai),
        }),
      });
      if (res.ok) {
        window.location.assign("/marches");
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
    <form className="card" onSubmit={submit}>
      <label htmlFor="ref">{t("reference")}</label>
      <input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} required maxLength={64} />
      <label htmlFor="projet">{t("projet")}</label>
      <select id="projet" value={projetId} onChange={(e) => setProjetId(e.target.value)}>
        {projets.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      <label htmlFor="entreprise">{t("entreprise")}</label>
      <select id="entreprise" value={entrepriseId} onChange={(e) => setEntrepriseId(e.target.value)}>
        {entreprises.map((en) => (
          <option key={en.id} value={en.id}>{en.label}</option>
        ))}
      </select>
      <label htmlFor="objet">{t("objet")}</label>
      <input id="objet" value={objet} onChange={(e) => setObjet(e.target.value)} required maxLength={500} />
      <label htmlFor="montant">{t("montant")}</label>
      <input id="montant" type="number" min="0" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} required />
      <small className="meta">{t("montantAide")}</small>
      <label htmlFor="notif">{t("dateNotification")}</label>
      <input id="notif" type="date" value={dateNotification} onChange={(e) => setDateNotification(e.target.value)} />
      <label htmlFor="delai">{t("delai")}</label>
      <input id="delai" type="number" min="1" value={delai} onChange={(e) => setDelai(e.target.value)} />
      <button type="submit" disabled={busy}>{busy ? tc("enregistrement") : tc("creer")}</button>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </form>
  );
}
