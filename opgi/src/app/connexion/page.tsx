"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

export default function ConnexionPage() {
  const t = useTranslations("connexion");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, email, password }),
      });
      if (res.ok) {
        window.location.assign("/tableau-de-bord");
        return;
      }
      setErreur(t("echec"));
    } catch {
      setErreur(t("erreurReseau"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <main>
      <h1>{t("titre")}</h1>
      <form className="card" onSubmit={onSubmit}>
        <label htmlFor="code">{t("codeOpgi")}</label>
        <input
          id="code"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("codeAide")}
          autoComplete="organization"
          required
        />

        <label htmlFor="email">{t("email")}</label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />

        <label htmlFor="password">{t("motDePasse")}</label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        <button type="submit" disabled={enCours}>
          {enCours ? t("enCours") : t("valider")}
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
