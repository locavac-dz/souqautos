"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function BoutonArchiver({ url }: { url: string }) {
  const t = useTranslations("commun");
  const [enCours, setEnCours] = useState(false);
  async function archiver() {
    setEnCours(true);
    const res = await fetch(url, { method: "DELETE" });
    if (res.ok) window.location.reload();
    else setEnCours(false);
  }
  return (
    <button type="button" onClick={archiver} disabled={enCours}>
      {t("archiver")}
    </button>
  );
}
