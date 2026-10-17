"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

const TYPES = ["LOGEMENT", "LOCAL_COMMERCIAL", "GARAGE", "AUTRE"] as const;
const ETATS = ["VACANT", "OCCUPE", "INDISPONIBLE"] as const;

export default function NouveauBien() {
  const t = useTranslations("patrimoine");
  const ts = useTranslations("sites");
  const tb = useTranslations("batiments");
  const tc = useTranslations("commun");
  const [code, setCode] = useState("");
  const [type, setType] = useState<string>("LOGEMENT");
  const [etat, setEtat] = useState<string>("VACANT");
  const [adresse, setAdresse] = useState("");
  const [siteId, setSiteId] = useState<string>("");
  const [sites, setSites] = useState<{ id: string; code: string; nom: string }[]>([]);
  const [batimentId, setBatimentId] = useState<string>("");
  const [batiments, setBatiments] = useState<{ id: string; code: string; nom: string; siteId: string }[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Charge sites et bâtiments de l'organisme courant pour le rattachement (facultatif).
  useEffect(() => {
    fetch("/api/sites")
      .then((r) => (r.ok ? r.json() : { sites: [] }))
      .then((b: { sites?: { id: string; code: string; nom: string }[] }) => setSites(b.sites ?? []))
      .catch(() => setSites([]));
    fetch("/api/batiments")
      .then((r) => (r.ok ? r.json() : { batiments: [] }))
      .then((b: { batiments?: { id: string; code: string; nom: string; siteId: string }[] }) =>
        setBatiments(b.batiments ?? []),
      )
      .catch(() => setBatiments([]));
  }, []);

  // Si un site est choisi, ne proposer que ses bâtiments ; réinitialiser le
  // bâtiment s'il n'appartient pas au site sélectionné.
  const batimentsVisibles = siteId ? batiments.filter((b) => b.siteId === siteId) : batiments;
  useEffect(() => {
    if (batimentId && !batimentsVisibles.some((b) => b.id === batimentId)) setBatimentId("");
  }, [siteId, batimentId, batimentsVisibles]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/biens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          type,
          etatOccupation: etat,
          adresse: adresse || null,
          siteId: siteId || null,
          batimentId: batimentId || null,
        }),
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

        <label htmlFor="site">{ts("site")}</label>
        <select id="site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">{ts("aucunSite")}</option>
          {sites.map((x) => (
            <option key={x.id} value={x.id}>
              {x.code} — {x.nom}
            </option>
          ))}
        </select>

        <label htmlFor="batiment">{tb("titreSingulier")}</label>
        <select id="batiment" value={batimentId} onChange={(e) => setBatimentId(e.target.value)}>
          <option value="">{tb("aucun")}</option>
          {batimentsVisibles.map((x) => (
            <option key={x.id} value={x.id}>
              {x.code} — {x.nom}
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
