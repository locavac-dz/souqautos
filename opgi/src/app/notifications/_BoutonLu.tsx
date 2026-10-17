"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function BoutonLu({ id }: { id: string }) {
  const t = useTranslations("notifications");
  const [busy, setBusy] = useState(false);
  async function marquer() {
    setBusy(true);
    const res = await fetch(`/api/notifications/${id}/lu`, { method: "POST" });
    if (res.ok) window.location.reload();
    else setBusy(false);
  }
  return (
    <button type="button" onClick={marquer} disabled={busy}>
      {t("marquerLu")}
    </button>
  );
}
