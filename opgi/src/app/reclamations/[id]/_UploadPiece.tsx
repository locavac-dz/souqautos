"use client";

import { useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";

const MIMES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const MAX = 10 * 1024 * 1024;

async function toBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!);
  return btoa(bin);
}

export function UploadPiece({ reclamationId }: { reclamationId: string }) {
  const t = useTranslations("reclamations");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErreur(null);
    if (!MIMES.has(file.type)) {
      setErreur(t("pieceType"));
      return;
    }
    if (file.size > MAX) {
      setErreur(t("pieceTropGrande"));
      return;
    }
    setBusy(true);
    try {
      const contenuBase64 = await toBase64(file);
      const res = await fetch(`/api/reclamations/${reclamationId}/pieces`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nomFichier: file.name, typeMime: file.type, contenuBase64 }),
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

  return (
    <div style={{ marginTop: 8 }}>
      <label htmlFor="piece">{t("fichier")}</label>
      <input id="piece" type="file" accept="image/jpeg,image/png,application/pdf" onChange={onFile} disabled={busy} />
      {erreur && (
        <p className="erreur" role="alert">
          {erreur}
        </p>
      )}
    </div>
  );
}
