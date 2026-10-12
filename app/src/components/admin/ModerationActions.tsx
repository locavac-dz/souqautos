"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { ModerationAction } from "@/lib/moderation";

type Checklist = {
  photosMatch: boolean;
  descriptionAccurate: boolean;
  priceReasonable: boolean;
  noFraudSuspected: boolean;
};

const EMPTY_CHECKLIST: Checklist = {
  photosMatch: false,
  descriptionAccurate: false,
  priceReasonable: false,
  noFraudSuspected: false,
};

export function ModerationActions({
  listingId,
  status,
}: {
  listingId: string;
  status: "EN_ATTENTE" | "PUBLIEE" | "SUSPENDUE";
}) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Checklist>(EMPTY_CHECKLIST);

  const allChecked = checklist.photosMatch && checklist.descriptionAccurate && checklist.priceReasonable && checklist.noFraudSuspected;

  async function act(action: ModerationAction) {
    setPending(true);
    setError(null);

    const body: Record<string, unknown> = { action, reason: reason.trim() || undefined };
    if (action === "approve") {
      body.checklist = checklist;
    }

    const res = await fetch(`/api/admin/listings/${listingId}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setPending(false);

    if (res.ok) {
      router.refresh();
      return;
    }

    const resBody = await res.json().catch(() => null);
    if (resBody?.error === "reason_required") setError(t("reasonRequired"));
    else if (resBody?.error === "checklist_required" || resBody?.error === "checklist_incomplete") setError(t("checklistIncomplete"));
    else setError(t("actionError"));
  }

  const needsReason = status === "EN_ATTENTE" || status === "PUBLIEE";
  const showChecklist = status === "EN_ATTENTE" || status === "SUSPENDUE";

  function toggle(key: keyof Checklist) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-2">
      {showChecklist && (
        <fieldset className="space-y-1 rounded-md border border-slate-200 dark:border-slate-700 p-2">
          <legend className="px-1 text-xs font-medium text-slate-600 dark:text-slate-400">{t("checklistTitle")}</legend>
          <ChecklistItem checked={checklist.photosMatch} onChange={() => toggle("photosMatch")} label={t("checklistPhotos")} />
          <ChecklistItem checked={checklist.descriptionAccurate} onChange={() => toggle("descriptionAccurate")} label={t("checklistDescription")} />
          <ChecklistItem checked={checklist.priceReasonable} onChange={() => toggle("priceReasonable")} label={t("checklistPrice")} />
          <ChecklistItem checked={checklist.noFraudSuspected} onChange={() => toggle("noFraudSuspected")} label={t("checklistNoFraud")} />
        </fieldset>
      )}
      {needsReason && (
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("reasonPlaceholder")}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
      )}
      <div className="flex gap-2">
        {(status === "EN_ATTENTE" || status === "SUSPENDUE") && (
          <button
            type="button"
            onClick={() => act("approve")}
            disabled={pending || !allChecked}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {t("approve")}
          </button>
        )}
        {status === "EN_ATTENTE" && (
          <button
            type="button"
            onClick={() => act("reject")}
            disabled={pending}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {t("reject")}
          </button>
        )}
        {status === "PUBLIEE" && (
          <button
            type="button"
            onClick={() => act("suspend")}
            disabled={pending}
            className="rounded-md border border-orange-300 px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50"
          >
            {t("suspend")}
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ChecklistItem({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="rounded border-slate-300 text-emerald-600 dark:border-slate-600" />
      {label}
    </label>
  );
}
