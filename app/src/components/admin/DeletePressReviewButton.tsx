"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function DeletePressReviewButton({ reviewId }: { reviewId: string }) {
  const t = useTranslations("AdminPressReview");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    const res = await fetch(`/api/admin/press-reviews/${reviewId}`, { method: "DELETE" });
    setPending(false);
    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {t("delete")}
    </button>
  );
}
