"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function ModerateReviewButton({ reviewId, action }: { reviewId: string; action: "APPROVED" | "REJECTED" }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handle() {
    setPending(true);
    const res = await fetch(`/api/admin/reviews/${reviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action }),
    });
    setPending(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      className={`text-xs hover:underline disabled:opacity-50 ${action === "APPROVED" ? "text-emerald-600" : "text-red-600"}`}
    >
      {action === "APPROVED" ? t("approveReview") : t("rejectReview")}
    </button>
  );
}
