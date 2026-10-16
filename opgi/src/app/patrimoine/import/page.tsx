"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

interface Rejet {
  ligne: number;
  cle: string | null;
  raison: "invalide" | "doublon_fichier" | "doublon_base";
  detail: string;
}
interface Rapport {
  total: number;
  inseres: number;
  ignores: number;
  rejets: Rejet[];
}

export default function ImportPage() {
  const t = useTranslations("import");
  const tc = useTranslations("commun");
  const [type, setType] = useState<"biens" | "occupants">("biens");
  const [csv, setCsv] = useState("");
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setCsv(await f.text());
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setRapport(null);
    setBusy(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, csv }),
      });
      const body = (await res.json().catch(() => ({}))) as { rapport?: Rapport; error?: string };
      if (res.ok && body.rapport) setRapport(body.rapport);
      else setErreur(body.error ?? tc("erreur"));
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
      <h1>{t("titre")}</h1>
      <form className="card" onSubmit={submit}>
        <label htmlFor="type">{t("type")}</label>
        <select id="type" value={type} onChange={(e) => setType(e.target.value as "biens" | "occupants")}>
          <option value="biens">{t("typeBiens")}</option>
          <option value="occupants">{t("typeOccupants")}</option>
        </select>
        <p className="meta">{type === "biens" ? t("entetesBiens") : t("entetesOccupants")}</p>

        <label htmlFor="fichier">{t("fichier")}</label>
        <input id="fichier" type="file" accept=".csv,text/csv" onChange={onFile} />

        <label htmlFor="csv">CSV</label>
        <textarea
          id="csv"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={10}
          style={{ width: "100%", fontFamily: "monospace", padding: 10, borderRadius: 8, border: "1px solid var(--border)" }}
          required
        />
        <small className="meta">{t("colleAide")}</small>

        <button type="submit" disabled={busy}>
          {busy ? t("enCours") : t("importer")}
        </button>
        {erreur && (
          <p className="erreur" role="alert">
            {erreur}
          </p>
        )}
      </form>

      {rapport && (
        <section className="card" aria-label={t("rapport")} style={{ marginTop: 16 }}>
          <h2>{t("rapport")}</h2>
          <p className="meta">
            {t("total")} : <strong>{rapport.total}</strong> — {t("inseres")} :{" "}
            <strong>{rapport.inseres}</strong> — {t("ignores")} : <strong>{rapport.ignores}</strong>
          </p>
          {rapport.rejets.length === 0 ? (
            <p>{t("aucunRejet")}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("ligne")}</th>
                  <th scope="col">{t("cle")}</th>
                  <th scope="col">{t("raison")}</th>
                  <th scope="col">{t("detail")}</th>
                </tr>
              </thead>
              <tbody>
                {rapport.rejets.map((r, i) => (
                  <tr key={i}>
                    <td>{r.ligne}</td>
                    <td>{r.cle ?? "—"}</td>
                    <td>{t(`raison_${r.raison}`)}</td>
                    <td>{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </main>
  );
}
