"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

interface AppelOpt {
  id: string;
  periode: string;
  soldeCentimes: number;
}
interface PaiementOpt {
  id: string;
  reference: string | null;
  resteCentimes: number;
}

const MODES = ["VIREMENT", "ESPECES", "CHEQUE", "AUTRE"] as const;
const TYPES = ["RELANCE", "MISE_EN_DEMEURE", "ECHEANCIER", "CONTENTIEUX", "AUTRE"] as const;

function dzd(centimes: number): string {
  return (centimes / 100).toLocaleString("fr-DZ", { minimumFractionDigits: 2 });
}

/** Encapsule l'appel réseau + le rechargement de la page après succès. */
function usePost() {
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function post(url: string, body: unknown): Promise<boolean> {
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
        return true;
      }
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setErreur(b.error ?? "Erreur.");
      return false;
    } catch {
      setErreur("Erreur réseau.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { post, erreur, busy };
}

function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <details className="card" style={{ marginTop: 12 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>{titre}</summary>
      <div style={{ marginTop: 12 }}>{children}</div>
    </details>
  );
}

export function ContratActions({
  contratId,
  appels,
  paiements,
}: {
  contratId: string;
  appels: AppelOpt[];
  paiements: PaiementOpt[];
}) {
  const t = useTranslations("finances");

  return (
    <>
      <Bloc titre={t("ajouterAppel")}>
        <FormAppel contratId={contratId} />
      </Bloc>
      <Bloc titre={t("ajouterPaiement")}>
        <FormPaiement contratId={contratId} />
      </Bloc>
      <Bloc titre={t("ajouterImputation")}>
        <FormImputation appels={appels} paiements={paiements} />
      </Bloc>
      <Bloc titre={t("ajouterAction")}>
        <FormAction contratId={contratId} />
      </Bloc>
    </>
  );
}

function FormAppel({ contratId }: { contratId: string }) {
  const t = useTranslations("finances");
  const { post, erreur, busy } = usePost();
  const [periode, setPeriode] = useState("");
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");
  const [echeance, setEcheance] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    await post("/api/appels", {
      contratId,
      periode,
      libelle: libelle || null,
      montantCentimes: montant.trim() === "" ? undefined : Math.round(Number(montant) * 100),
      dateEcheance: echeance,
    });
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="ap-periode">{t("periode")}</label>
      <input id="ap-periode" value={periode} onChange={(e) => setPeriode(e.target.value)} required placeholder="2026-01" />
      <label htmlFor="ap-libelle">{t("libelle")}</label>
      <input id="ap-libelle" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
      <label htmlFor="ap-montant">{t("montant")}</label>
      <input id="ap-montant" type="number" min="0" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} />
      <small className="meta">{t("montantAide")}</small>
      <label htmlFor="ap-echeance">{t("echeance")}</label>
      <input id="ap-echeance" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} required />
      <button type="submit" disabled={busy}>{t("ajouterAppel")}</button>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </form>
  );
}

function FormPaiement({ contratId }: { contratId: string }) {
  const t = useTranslations("finances");
  const { post, erreur, busy } = usePost();
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState("");
  const [mode, setMode] = useState<string>("VIREMENT");
  const [reference, setReference] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    await post("/api/paiements", {
      contratId,
      montantCentimes: Math.round(Number(montant) * 100),
      datePaiement: date,
      mode,
      reference: reference || null,
    });
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="pa-montant">{t("montant")}</label>
      <input id="pa-montant" type="number" min="0" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} required />
      <label htmlFor="pa-date">{t("date")}</label>
      <input id="pa-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      <label htmlFor="pa-mode">{t("mode")}</label>
      <select id="pa-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
        {MODES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <label htmlFor="pa-ref">{t("reference")}</label>
      <input id="pa-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
      <button type="submit" disabled={busy}>{t("ajouterPaiement")}</button>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </form>
  );
}

function FormImputation({ appels, paiements }: { appels: AppelOpt[]; paiements: PaiementOpt[] }) {
  const t = useTranslations("finances");
  const { post, erreur, busy } = usePost();
  const [paiementId, setPaiementId] = useState(paiements[0]?.id ?? "");
  const [appelId, setAppelId] = useState(appels[0]?.id ?? "");
  const [montant, setMontant] = useState("");
  if (appels.length === 0 || paiements.length === 0) {
    return <p className="meta">{t("imputations")} — {t("aucunPaiement")}</p>;
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    await post("/api/imputations", {
      paiementId,
      appelId,
      montantCentimes: Math.round(Number(montant) * 100),
    });
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="im-paiement">{t("choisirPaiement")}</label>
      <select id="im-paiement" value={paiementId} onChange={(e) => setPaiementId(e.target.value)}>
        {paiements.map((p) => (
          <option key={p.id} value={p.id}>
            {(p.reference ?? p.id.slice(0, 6)) + " — " + dzd(p.resteCentimes)}
          </option>
        ))}
      </select>
      <label htmlFor="im-appel">{t("choisirAppel")}</label>
      <select id="im-appel" value={appelId} onChange={(e) => setAppelId(e.target.value)}>
        {appels.map((a) => (
          <option key={a.id} value={a.id}>
            {a.periode + " — " + dzd(a.soldeCentimes)}
          </option>
        ))}
      </select>
      <label htmlFor="im-montant">{t("montant")}</label>
      <input id="im-montant" type="number" min="0" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} required />
      <button type="submit" disabled={busy}>{t("ajouterImputation")}</button>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </form>
  );
}

function FormAction({ contratId }: { contratId: string }) {
  const t = useTranslations("finances");
  const { post, erreur, busy } = usePost();
  const [type, setType] = useState<string>("RELANCE");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [piece, setPiece] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    await post("/api/recouvrement", {
      contratId,
      type,
      date,
      note: note || null,
      pieceReference: piece || null,
    });
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="ac-type">{t("type")}</label>
      <select id="ac-type" value={type} onChange={(e) => setType(e.target.value)}>
        {TYPES.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
      <label htmlFor="ac-date">{t("date")}</label>
      <input id="ac-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      <label htmlFor="ac-note">{t("note")}</label>
      <input id="ac-note" value={note} onChange={(e) => setNote(e.target.value)} />
      <label htmlFor="ac-piece">{t("piece")}</label>
      <input id="ac-piece" value={piece} onChange={(e) => setPiece(e.target.value)} />
      <button type="submit" disabled={busy}>{t("ajouterAction")}</button>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </form>
  );
}
