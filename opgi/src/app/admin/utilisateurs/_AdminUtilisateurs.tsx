"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ROLES_ATTRIBUABLES } from "@/lib/auth/admin-schemas";

export interface CompteVue {
  id: string;
  email: string;
  role: string;
  perimetre: string | null;
  actif: boolean;
  deuxFacteurs: boolean;
  verrouille: boolean;
}

function recharger() {
  window.location.reload();
}

export function AdminUtilisateurs({ comptes, moiId }: { comptes: CompteVue[]; moiId: string }) {
  const t = useTranslations("admin");
  const tc = useTranslations("commun");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("AGENT_LOCATIF");
  const [perimetre, setPerimetre] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function creer(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/utilisateurs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role, perimetre: perimetre || null, password }),
      });
      if (res.ok) {
        recharger();
        return;
      }
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setErreur(b.error ?? tc("erreur"));
    } catch {
      setErreur(tc("erreur"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="card" aria-label={t("creerTitre")}>
        <h2>{t("creerTitre")}</h2>
        <form onSubmit={creer}>
          <label htmlFor="email">{t("email")}</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} />

          <label htmlFor="role">{t("role")}</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES_ATTRIBUABLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <label htmlFor="perimetre">{t("perimetre")}</label>
          <input id="perimetre" value={perimetre} onChange={(e) => setPerimetre(e.target.value)} maxLength={120} />

          <label htmlFor="password">{t("motDePasseInitial")}</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            maxLength={200}
          />

          <button type="submit" disabled={busy || !email || !password}>
            {busy ? tc("enregistrement") : tc("creer")}
          </button>
          {erreur && (
            <p className="erreur" role="alert">
              {erreur}
            </p>
          )}
        </form>
      </section>

      <section className="card" aria-label={t("titre")} style={{ marginTop: 16 }}>
        {comptes.length === 0 ? (
          <p>{t("aucun")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("email")}</th>
                <th scope="col">{t("role")}</th>
                <th scope="col">{t("perimetre")}</th>
                <th scope="col">{t("etat")}</th>
                <th scope="col">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {comptes.map((c) => (
                <LigneCompte key={c.id} compte={c} moi={c.id === moiId} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function LigneCompte({ compte, moi }: { compte: CompteVue; moi: boolean }) {
  const t = useTranslations("admin");
  const tc = useTranslations("commun");
  const [role, setRole] = useState(compte.role);
  const [busy, setBusy] = useState(false);

  async function patch(body: unknown) {
    setBusy(true);
    const res = await fetch(`/api/admin/utilisateurs/${compte.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) recharger();
    else setBusy(false);
  }
  async function reinitialiser() {
    const mdp = window.prompt(t("nouveauMotDePasse"));
    if (!mdp) return;
    setBusy(true);
    const res = await fetch(`/api/admin/utilisateurs/${compte.id}/mot-de-passe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: mdp }),
    });
    if (res.ok) {
      window.alert(t("motDePasseReinitialise"));
      recharger();
    } else setBusy(false);
  }

  return (
    <tr>
      <td>{compte.email}</td>
      <td>
        <select value={role} onChange={(e) => setRole(e.target.value)} disabled={moi}>
          {ROLES_ATTRIBUABLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {role !== compte.role && (
          <button type="button" onClick={() => patch({ role })} disabled={busy}>
            {tc("enregistrer")}
          </button>
        )}
      </td>
      <td>{compte.perimetre ?? "—"}</td>
      <td>
        {compte.actif ? t("actif") : t("inactif")}
        {compte.deuxFacteurs ? " · 2FA" : ""}
        {compte.verrouille ? ` · ${t("verrouille")}` : ""}
      </td>
      <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!moi && (
          <button type="button" onClick={() => patch({ actif: !compte.actif })} disabled={busy}>
            {compte.actif ? t("desactiver") : t("activer")}
          </button>
        )}
        <button type="button" onClick={reinitialiser} disabled={busy}>
          {t("reinitialiserMotDePasse")}
        </button>
      </td>
    </tr>
  );
}
