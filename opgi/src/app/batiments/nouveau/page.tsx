"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export default function NouveauBatiment() {
  const t = useTranslations("batiments");
  const tc = useTranslations("commun");
  const [siteId, setSiteId] = useState<string>("");
  const [sites, setSites] = useState<{ id: string; code: string; nom: string }[]>([]);
  const [code, setCode] = useState("");
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Charge les sites de l'organisme courant (un bâtiment est rattaché à un site).
  useEffect(() => {
    fetch("/api/sites")
      .then((r) => (r.ok ? r.json() : { sites: [] }))
      .then((b: { sites?: { id: string; code: string; nom: string }[] }) => setSites(b.sites ?? []))
      .catch(() => setSites([]));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/batiments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId, code, nom }),
      });
      if (res.ok) {
        window.location.assign("/batiments");
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
        <Link href="/batiments">{tc("retour")}</Link>
      </p>
      <h1>{t("nouveauTitre")}</h1>
      <form className="card" onSubmit={submit}>
        <label htmlFor="site">{t("site")}</label>
        <select id="site" value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
          <option value="">{t("choisirSite")}</option>
          {sites.map((x) => (
            <option key={x.id} value={x.id}>
              {x.code} — {x.nom}
            </option>
          ))}
        </select>

        <label htmlFor="code">{t("code")}</label>
        <input id="code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={64} />

        <label htmlFor="nom">{t("nom")}</label>
        <input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} required maxLength={200} />

        <button type="submit" disabled={busy || !siteId}>
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
