"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

interface Option {
  id: string;
  label: string;
}

const STATUTS = ["BROUILLON", "ACTIF", "SUSPENDU", "RESILIE"] as const;

export function FormContrat({ biens, occupants }: { biens: Option[]; occupants: Option[] }) {
  const t = useTranslations("contrats");
  const tc = useTranslations("commun");
  const [reference, setReference] = useState("");
  const [bienId, setBienId] = useState(biens[0]?.id ?? "");
  const [occupantId, setOccupantId] = useState(occupants[0]?.id ?? "");
  const [statut, setStatut] = useState<string>("BROUILLON");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [loyer, setLoyer] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const montant = loyer.trim() === "" ? null : Math.round(Number(loyer) * 100);
      const res = await fetch("/api/contrats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reference,
          bienId,
          occupantId,
          statut,
          dateDebut,
          dateFin: dateFin || null,
          montantLoyerCentimes: montant,
        }),
      });
      if (res.ok) {
        window.location.assign("/contrats");
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
      <label htmlFor="reference">{t("reference")}</label>
      <input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} required maxLength={64} />

      <label htmlFor="bien">{t("bien")}</label>
      <select id="bien" value={bienId} onChange={(e) => setBienId(e.target.value)} required>
        {biens.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>

      <label htmlFor="occupant">{t("occupant")}</label>
      <select id="occupant" value={occupantId} onChange={(e) => setOccupantId(e.target.value)} required>
        {occupants.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>

      <label htmlFor="statut">{t("statut")}</label>
      <select id="statut" value={statut} onChange={(e) => setStatut(e.target.value)}>
        {STATUTS.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>

      <label htmlFor="dateDebut">{t("dateDebut")}</label>
      <input id="dateDebut" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required />

      <label htmlFor="dateFin">{t("dateFin")}</label>
      <input id="dateFin" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />

      <label htmlFor="loyer">{t("loyer")}</label>
      <input id="loyer" type="number" min="0" step="0.01" value={loyer} onChange={(e) => setLoyer(e.target.value)} />
      <small className="meta">{t("loyerAide")}</small>

      <button type="submit" disabled={busy}>
        {busy ? tc("enregistrement") : tc("creer")}
      </button>
      {erreur && (
        <p className="erreur" role="alert">
          {erreur}
        </p>
      )}
    </form>
  );
}
