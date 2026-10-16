"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

const TYPES = ["PHYSIQUE", "MORALE"] as const;

export default function NouvelOccupant() {
  const t = useTranslations("occupants");
  const tc = useTranslations("commun");
  const [type, setType] = useState<string>("PHYSIQUE");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/occupants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          nom,
          prenom: prenom || null,
          telephone: telephone || null,
          email: email || null,
        }),
      });
      if (res.ok) {
        window.location.assign("/occupants");
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
        <Link href="/occupants">{tc("retour")}</Link>
      </p>
      <h1>{t("nouveauTitre")}</h1>
      <form className="card" onSubmit={submit}>
        <label htmlFor="type">{t("type")}</label>
        <select id="type" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((v) => (
            <option key={v} value={v}>
              {t(`type${v}`)}
            </option>
          ))}
        </select>

        <label htmlFor="nom">{t("nom")}</label>
        <input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} required maxLength={200} />

        <label htmlFor="prenom">{t("prenom")}</label>
        <input id="prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} maxLength={200} />

        <label htmlFor="telephone">{t("telephone")}</label>
        <input id="telephone" value={telephone} onChange={(e) => setTelephone(e.target.value)} maxLength={40} />

        <label htmlFor="email">{t("email")}</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />

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
