"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { SelecteurLangue } from "@/app/_components/SelecteurLangue";

export default function ConnexionPage() {
  const t = useTranslations("connexion");
  const tp = useTranslations("portail");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code2fa, setCode2fa] = useState("");
  const [besoin2fa, setBesoin2fa] = useState(false);
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
        body: JSON.stringify({ code, email, password, code2fa: code2fa || undefined }),
      });
      if (res.ok) {
        window.location.assign("/tableau-de-bord");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { twoFactorRequired?: boolean };
      if (body.twoFactorRequired) {
        // Mot de passe correct : afficher le champ du code 2FA.
        setBesoin2fa(true);
        setErreur(code2fa ? t("code2faInvalide") : t("code2faRequis"));
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
      <p style={{ display: "flex", justifyContent: "flex-end" }}>
        <SelecteurLangue />
      </p>
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

        {besoin2fa && (
          <>
            <label htmlFor="code2fa">{t("code2fa")}</label>
            <input
              id="code2fa"
              name="code2fa"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code2fa}
              onChange={(e) => setCode2fa(e.target.value)}
              placeholder={t("code2faAide")}
              required
            />
          </>
        )}

        <button type="submit" disabled={enCours}>
          {enCours ? t("enCours") : t("valider")}
        </button>

        {erreur && (
          <p className="erreur" role="alert">
            {erreur}
          </p>
        )}
      </form>
      <p style={{ marginTop: 16 }}>
        <Link href="/portail">{tp("titre")}</Link>
      </p>
    </main>
  );
}
