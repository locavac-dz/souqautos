"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

export function FormDeuxFacteurs({ actifInitial }: { actifInitial: boolean }) {
  const t = useTranslations("compte");
  const tc = useTranslations("commun");
  const [actif, setActif] = useState(actifInitial);
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function debuter() {
    setErreur(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch("/api/compte/2fa/debut", { method: "POST" });
      if (res.ok) {
        const b = (await res.json()) as { secret: string; uri: string };
        setSecret(b.secret);
        setUri(b.uri);
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

  async function activer(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/compte/2fa/activer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        setActif(true);
        setSecret(null);
        setUri(null);
        setCode("");
        setMessage(t("deuxFacteursActivee"));
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

  async function desactiver(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/compte/2fa/desactiver", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ motDePasse }),
      });
      if (res.ok) {
        setActif(false);
        setMotDePasse("");
        setMessage(t("deuxFacteursDesactivee"));
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
    <section>
      <h2>{t("deuxFacteursTitre")}</h2>
      <p>{actif ? t("deuxFacteursActif") : t("deuxFacteursInactif")}</p>

      {actif ? (
        <form className="card" onSubmit={desactiver}>
          <label htmlFor="mdp2fa">{t("deuxFacteursMotDePasse")}</label>
          <input
            id="mdp2fa"
            type="password"
            autoComplete="current-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            required
          />
          <button type="submit" disabled={busy}>
            {busy ? tc("enregistrement") : t("deuxFacteursDesactiver")}
          </button>
        </form>
      ) : secret ? (
        <form className="card" onSubmit={activer}>
          <p>{t("deuxFacteursInstructions")}</p>
          <label>{t("deuxFacteursSecret")}</label>
          <code>{secret}</code>
          <label>{t("deuxFacteursUri")}</label>
          <code style={{ wordBreak: "break-all" }}>{uri}</code>
          <label htmlFor="code2fa-activer">{t("deuxFacteursCode")}</label>
          <input
            id="code2fa-activer"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <button type="submit" disabled={busy}>
            {busy ? tc("enregistrement") : t("deuxFacteursConfirmer")}
          </button>
        </form>
      ) : (
        <button type="button" onClick={debuter} disabled={busy}>
          {t("deuxFacteursActiver")}
        </button>
      )}

      {message && (
        <p className="succes" role="status">
          {message}
        </p>
      )}
      {erreur && (
        <p className="erreur" role="alert">
          {erreur}
        </p>
      )}
    </section>
  );
}
