"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

interface Resume {
  periode: string;
  contratsActifs: number;
  crees: number;
  ignoresExistants: number;
  ignoresSansLoyer: number;
}

export function GenererAppels() {
  const t = useTranslations("appels");
  const tc = useTranslations("commun");
  const [periode, setPeriode] = useState("");
  const [dateEcheance, setDateEcheance] = useState("");
  const [libelle, setLibelle] = useState("");
  const [resume, setResume] = useState<Resume | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setResume(null);
    setBusy(true);
    try {
      const res = await fetch("/api/appels/generer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ periode, dateEcheance, libelle: libelle || null }),
      });
      if (res.ok) {
        const body = (await res.json()) as { resume: Resume };
        setResume(body.resume);
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
    <section className="card" aria-label={t("genererTitre")}>
      <h2>{t("genererTitre")}</h2>
      <p className="meta">{t("genererAide")}</p>
      <form onSubmit={submit}>
        <label htmlFor="periode">{t("periode")}</label>
        <input
          id="periode"
          value={periode}
          onChange={(e) => setPeriode(e.target.value)}
          required
          maxLength={20}
          placeholder={t("periodePlaceholder")}
        />

        <label htmlFor="echeance">{t("echeance")}</label>
        <input
          id="echeance"
          type="date"
          value={dateEcheance}
          onChange={(e) => setDateEcheance(e.target.value)}
          required
        />

        <label htmlFor="libelle">{t("libelle")}</label>
        <input id="libelle" value={libelle} onChange={(e) => setLibelle(e.target.value)} maxLength={200} />

        <button type="submit" disabled={busy || !periode || !dateEcheance}>
          {busy ? tc("enregistrement") : t("genererBouton")}
        </button>
      </form>

      {erreur && (
        <p className="erreur" role="alert">
          {erreur}
        </p>
      )}
      {resume && (
        <div role="status" style={{ marginTop: 12 }}>
          <p>
            <strong>{t("resumeTitre", { periode: resume.periode })}</strong>
          </p>
          <ul>
            <li>{t("resumeCrees", { n: resume.crees })}</li>
            <li>{t("resumeExistants", { n: resume.ignoresExistants })}</li>
            <li>{t("resumeSansLoyer", { n: resume.ignoresSansLoyer })}</li>
            <li>{t("resumeContratsActifs", { n: resume.contratsActifs })}</li>
          </ul>
        </div>
      )}
    </section>
  );
}
