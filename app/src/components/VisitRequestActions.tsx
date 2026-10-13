"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type SellerProps = { visitId: string; role: "seller" };
type BuyerProps = { visitId: string; role: "buyer" };

export function VisitRequestActions(props: SellerProps | BuyerProps) {
  const t = useTranslations("VisitRequest");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showNoteField, setShowNoteField] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(action: "confirm" | "decline" | "cancel") {
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, string> = { action };
      if (action === "confirm" && note.trim()) body.sellerNote = note.trim();
      const res = await fetch(`/api/visit-requests/${props.visitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.refresh();
      } else {
        setError(t("errorGeneric"));
      }
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  if (props.role === "buyer") {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => act("cancel")}
          disabled={loading}
          className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950 disabled:opacity-50"
        >
          {t("cancelVisit")}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {showNoteField && (
        <div className="w-full">
          <textarea
            maxLength={500}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("sellerNotePlaceholder")}
            className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => {
            if (!showNoteField) { setShowNoteField(true); return; }
            act("confirm");
          }}
          disabled={loading}
          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {t("confirm")}
        </button>
        <button
          onClick={() => act("decline")}
          disabled={loading}
          className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950 disabled:opacity-50"
        >
          {t("decline")}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
