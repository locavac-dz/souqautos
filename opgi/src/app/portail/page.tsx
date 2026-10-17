"use client";

// Portail PUBLIC de dépôt de réclamation — accessible SANS authentification
// (aucune garde de session). Seule la référence d'accusé de réception est
// renvoyée ; aucune donnée d'un organisme n'est affichée.
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { SelecteurLangue } from "@/app/_components/SelecteurLangue";

const CATEGORIES = [
  "PLOMBERIE",
  "ELECTRICITE",
  "MACONNERIE",
  "ASCENSEUR",
  "CHAUFFAGE",
  "PROPRETE",
  "AUTRE",
] as const;

export default function PortailPage() {
  const t = useTranslations("portail");
  const te = useTranslations("enums");
  const [code, setCode] = useState("");
  const [categorie, setCategorie] = useState<string>("PLOMBERIE");
  const [description, setDescription] = useState("");
  const [nom, setNom] = useState("");
  const [contact, setContact] = useState("");
  const [localisation, setLocalisation] = useState("");
  const [reference, setReference] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/portail/reclamations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          categorie,
          description,
          declarantNom: nom || undefined,
          declarantContact: contact || undefined,
          localisation: localisation || undefined,
        }),
      });
      if (res.ok) {
        const b = (await res.json()) as { reference: string };
        setReference(b.reference);
        return;
      }
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setErreur(b.error ?? t("erreur"));
    } catch {
      setErreur(t("erreur"));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setReference(null);
    setDescription("");
    setNom("");
    setContact("");
    setLocalisation("");
  }

  return (
    <main>
      <p style={{ display: "flex", justifyContent: "flex-end" }}>
        <SelecteurLangue />
      </p>
      <h1>{t("titre")}</h1>

      {reference ? (
        <div className="card" role="status">
          <h2>{t("succesTitre")}</h2>
          <p>
            {t("succesRef")} <strong>{reference}</strong>
          </p>
          <p className="meta">{t("succesNote")}</p>
          <button type="button" onClick={reset}>
            {t("nouvelle")}
          </button>
        </div>
      ) : (
        <form className="card" onSubmit={submit}>
          <p className="meta">{t("intro")}</p>

          <label htmlFor="code">{t("code")}</label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("codeAide")}
            required
          />

          <label htmlFor="categorie">{t("categorie")}</label>
          <select id="categorie" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {te(`categorieReclamation.${c}`)}
              </option>
            ))}
          </select>

          <label htmlFor="description">{t("description")}</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={5}
            maxLength={5000}
            rows={4}
          />

          <label htmlFor="nom">{t("declarantNom")}</label>
          <input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={200} />

          <label htmlFor="contact">{t("declarantContact")}</label>
          <input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} />

          <label htmlFor="localisation">{t("localisation")}</label>
          <input
            id="localisation"
            value={localisation}
            onChange={(e) => setLocalisation(e.target.value)}
            maxLength={500}
          />

          <button type="submit" disabled={busy}>
            {busy ? t("enCours") : t("envoyer")}
          </button>
          {erreur && (
            <p className="erreur" role="alert">
              {erreur}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
