"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

const STATUTS = ["NOUVELLE", "QUALIFIEE", "EN_COURS", "RESOLUE", "REJETEE"] as const;
const URGENCES = ["FAIBLE", "NORMALE", "HAUTE", "CRITIQUE"] as const;
const AFFECTATIONS = ["INTERNE", "EXTERNE"] as const;

function usePost() {
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function post(url: string, body: unknown): Promise<void> {
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setErreur(b.error ?? "Erreur.");
    } catch {
      setErreur("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }
  async function patch(url: string, body: unknown): Promise<void> {
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setErreur(b.error ?? "Erreur.");
    } catch {
      setErreur("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }
  return { post, patch, erreur, busy };
}

function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <details className="card" style={{ marginTop: 12 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>{titre}</summary>
      <div style={{ marginTop: 12 }}>{children}</div>
    </details>
  );
}

export function ReclamationActions({
  reclamationId,
  canCreer,
  canModifier,
}: {
  reclamationId: string;
  canCreer: boolean;
  canModifier: boolean;
}) {
  const t = useTranslations("reclamations");
  return (
    <>
      {canModifier && (
        <Bloc titre={t("qualifier")}>
          <FormQualifier reclamationId={reclamationId} />
        </Bloc>
      )}
      {canCreer && (
        <Bloc titre={t("ajouterCommentaire")}>
          <FormCommentaire reclamationId={reclamationId} canInterne={canModifier} />
        </Bloc>
      )}
      {canModifier && (
        <Bloc titre={t("ajouterOrdre")}>
          <FormOrdre reclamationId={reclamationId} />
        </Bloc>
      )}
    </>
  );
}

function FormQualifier({ reclamationId }: { reclamationId: string }) {
  const t = useTranslations("reclamations");
  const { patch, erreur, busy } = usePost();
  const [statut, setStatut] = useState<string>("QUALIFIEE");
  const [urgence, setUrgence] = useState<string>("NORMALE");
  async function submit(e: FormEvent) {
    e.preventDefault();
    await patch(`/api/reclamations/${reclamationId}`, { statut, urgence });
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="q-statut">{t("statut")}</label>
      <select id="q-statut" value={statut} onChange={(e) => setStatut(e.target.value)}>
        {STATUTS.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
      <label htmlFor="q-urgence">{t("urgence")}</label>
      <select id="q-urgence" value={urgence} onChange={(e) => setUrgence(e.target.value)}>
        {URGENCES.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
      <button type="submit" disabled={busy}>{t("qualifier")}</button>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </form>
  );
}

function FormCommentaire({ reclamationId, canInterne }: { reclamationId: string; canInterne: boolean }) {
  const t = useTranslations("reclamations");
  const { post, erreur, busy } = usePost();
  const [texte, setTexte] = useState("");
  const [interne, setInterne] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    await post(`/api/reclamations/${reclamationId}/commentaires`, { texte, interne });
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="c-texte">{t("texte")}</label>
      <input id="c-texte" value={texte} onChange={(e) => setTexte(e.target.value)} required maxLength={5000} />
      {canInterne && (
        <label style={{ fontWeight: 400 }}>
          <input type="checkbox" checked={interne} onChange={(e) => setInterne(e.target.checked)} style={{ width: "auto" }} />{" "}
          {t("interne")}
        </label>
      )}
      <button type="submit" disabled={busy}>{t("ajouterCommentaire")}</button>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </form>
  );
}

function FormOrdre({ reclamationId }: { reclamationId: string }) {
  const t = useTranslations("reclamations");
  const { post, erreur, busy } = usePost();
  const [affectation, setAffectation] = useState<string>("INTERNE");
  const [technicien, setTechnicien] = useState("");
  const [prestataire, setPrestataire] = useState("");
  const [datePlanifiee, setDatePlanifiee] = useState("");
  const [coutEstime, setCoutEstime] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    await post("/api/ordres", {
      reclamationId,
      affectationType: affectation,
      technicienUtilisateurId: affectation === "INTERNE" ? technicien || null : null,
      prestataireNom: affectation === "EXTERNE" ? prestataire || null : null,
      datePlanifiee: datePlanifiee || null,
      coutEstimeCentimes: coutEstime.trim() === "" ? null : Math.round(Number(coutEstime) * 100),
    });
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="o-aff">{t("affectation")}</label>
      <select id="o-aff" value={affectation} onChange={(e) => setAffectation(e.target.value)}>
        {AFFECTATIONS.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
      {affectation === "INTERNE" ? (
        <>
          <label htmlFor="o-tech">{t("technicien")}</label>
          <input id="o-tech" value={technicien} onChange={(e) => setTechnicien(e.target.value)} />
        </>
      ) : (
        <>
          <label htmlFor="o-prest">{t("prestataire")}</label>
          <input id="o-prest" value={prestataire} onChange={(e) => setPrestataire(e.target.value)} />
        </>
      )}
      <label htmlFor="o-date">{t("datePlanifiee")}</label>
      <input id="o-date" type="date" value={datePlanifiee} onChange={(e) => setDatePlanifiee(e.target.value)} />
      <label htmlFor="o-cout">{t("coutEstime")}</label>
      <input id="o-cout" type="number" min="0" step="0.01" value={coutEstime} onChange={(e) => setCoutEstime(e.target.value)} />
      <small className="meta">{t("coutAide")}</small>
      <button type="submit" disabled={busy}>{t("ajouterOrdre")}</button>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </form>
  );
}
