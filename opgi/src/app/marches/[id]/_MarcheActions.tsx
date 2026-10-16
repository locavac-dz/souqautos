"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

interface SituationOpt {
  id: string;
  numero: number;
  statut: string;
}

function useSend() {
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function send(url: string, body: unknown): Promise<void> {
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
  return { send, erreur, busy };
}

function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <details className="card" style={{ marginTop: 12 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>{titre}</summary>
      <div style={{ marginTop: 12 }}>{children}</div>
    </details>
  );
}

export function MarcheActions({
  marcheId,
  situations,
  canCreer,
  canModifier,
}: {
  marcheId: string;
  situations: SituationOpt[];
  canCreer: boolean;
  canModifier: boolean;
}) {
  const t = useTranslations("marches");
  return (
    <>
      {canCreer && (
        <Bloc titre={t("ajouterSituation")}>
          <FormSituation marcheId={marcheId} />
        </Bloc>
      )}
      {canModifier && situations.length > 0 && (
        <Bloc titre={t("decision")}>
          <FormDecision situations={situations} />
        </Bloc>
      )}
      {canModifier && (
        <Bloc titre={t("ajouterReception")}>
          <FormReception marcheId={marcheId} />
        </Bloc>
      )}
    </>
  );
}

function FormSituation({ marcheId }: { marcheId: string }) {
  const t = useTranslations("marches");
  const { send, erreur, busy } = useSend();
  const [numero, setNumero] = useState("");
  const [periode, setPeriode] = useState("");
  const [montant, setMontant] = useState("");
  const [pct, setPct] = useState("");
  const [date, setDate] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    await send(`/api/marches/${marcheId}/situations`, {
      numero: Number(numero),
      periode: periode || null,
      montantTravauxCentimes: Math.round(Number(montant) * 100),
      avancementPhysiquePct: pct.trim() === "" ? null : Number(pct),
      dateDepot: date,
    });
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="s-num">{t("numero")}</label>
      <input id="s-num" type="number" min="1" value={numero} onChange={(e) => setNumero(e.target.value)} required />
      <label htmlFor="s-per">{t("periode")}</label>
      <input id="s-per" value={periode} onChange={(e) => setPeriode(e.target.value)} />
      <label htmlFor="s-mnt">{t("montantTravaux")}</label>
      <input id="s-mnt" type="number" min="0" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} required />
      <label htmlFor="s-pct">{t("avancementPct")}</label>
      <input id="s-pct" type="number" min="0" max="100" value={pct} onChange={(e) => setPct(e.target.value)} />
      <label htmlFor="s-date">{t("date")}</label>
      <input id="s-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      <button type="submit" disabled={busy}>{t("ajouterSituation")}</button>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </form>
  );
}

function FormDecision({ situations }: { situations: SituationOpt[] }) {
  const t = useTranslations("marches");
  const { send, erreur, busy } = useSend();
  const [situationId, setSituationId] = useState(situations[0]?.id ?? "");
  const [decision, setDecision] = useState("VERIFIEE");
  async function submit(e: FormEvent) {
    e.preventDefault();
    await send(`/api/situations/${situationId}/decision`, { decision });
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="d-sit">{t("situations")}</label>
      <select id="d-sit" value={situationId} onChange={(e) => setSituationId(e.target.value)}>
        {situations.map((x) => (
          <option key={x.id} value={x.id}>
            {t("numero")} {x.numero} — {x.statut}
          </option>
        ))}
      </select>
      <label htmlFor="d-dec">{t("decision")}</label>
      <select id="d-dec" value={decision} onChange={(e) => setDecision(e.target.value)}>
        <option value="VERIFIEE">{t("verifier")}</option>
        <option value="VALIDEE">{t("valider")}</option>
        <option value="REJETEE">{t("rejeter")}</option>
      </select>
      <button type="submit" disabled={busy}>{t("decision")}</button>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </form>
  );
}

function FormReception({ marcheId }: { marcheId: string }) {
  const t = useTranslations("marches");
  const { send, erreur, busy } = useSend();
  const [type, setType] = useState("PROVISOIRE");
  const [date, setDate] = useState("");
  const [avecReserves, setAvecReserves] = useState(false);
  const [pv, setPv] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    await send(`/api/marches/${marcheId}/receptions`, {
      type,
      date,
      avecReserves,
      pvReference: pv || null,
    });
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="r-type">{t("type")}</label>
      <select id="r-type" value={type} onChange={(e) => setType(e.target.value)}>
        <option value="PROVISOIRE">PROVISOIRE</option>
        <option value="DEFINITIVE">DEFINITIVE</option>
      </select>
      <label htmlFor="r-date">{t("date")}</label>
      <input id="r-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      <label style={{ fontWeight: 400 }}>
        <input type="checkbox" checked={avecReserves} onChange={(e) => setAvecReserves(e.target.checked)} style={{ width: "auto" }} />{" "}
        {t("avecReserves")}
      </label>
      <label htmlFor="r-pv">{t("pv")}</label>
      <input id="r-pv" value={pv} onChange={(e) => setPv(e.target.value)} />
      <button type="submit" disabled={busy}>{t("ajouterReception")}</button>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </form>
  );
}
