"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function DeleteConversationButton({
  conversationId,
  onDeleted,
}: {
  conversationId: string;
  onDeleted?: () => void;
}) {
  const t = useTranslations("Messages");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setPending(true);
    const res = await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" });
    setPending(false);
    if (res.ok) {
      if (onDeleted) {
        onDeleted();
      } else {
        router.push("/compte/messages");
        router.refresh();
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      onBlur={() => setConfirming(false)}
      disabled={pending}
      className="shrink-0 text-xs text-slate-400 hover:text-red-600 disabled:opacity-50"
    >
      {confirming ? t("confirmDeleteConversation") : t("deleteConversation")}
    </button>
  );
}
