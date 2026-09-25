"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { DeleteConversationButton } from "./DeleteConversationButton";
import { ReportUserButton } from "@/components/ReportUserButton";

type SentMessage = {
  id: string;
  senderId: string;
  content: string;
  attachmentUrl: string | null;
  createdAt: string;
};

export function MessageThread({
  conversationId,
  otherUserId,
  initialBlocked,
  blockedByOther,
  initialAlreadyReported,
  onSent,
}: {
  conversationId: string;
  otherUserId: string;
  initialBlocked: boolean;
  blockedByOther: boolean;
  initialAlreadyReported: boolean;
  onSent?: (message: SentMessage) => void;
}) {
  const t = useTranslations("Messages");
  const router = useRouter();
  const [content, setContent] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachmentPreview = useMemo(
    () => (attachment ? URL.createObjectURL(attachment) : null),
    [attachment]
  );
  useEffect(() => {
    return () => {
      if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    };
  }, [attachmentPreview]);

  function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAttachment(e.target.files?.[0] ?? null);
  }

  function removeAttachment() {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && !attachment) return;
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("content", content.trim());
    if (attachment) formData.set("attachment", attachment);

    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: formData,
    });

    setPending(false);

    if (res.ok) {
      const data = await res.json();
      setContent("");
      removeAttachment();
      onSent?.(data.message);
      return;
    }

    const data = await res.json().catch(() => null);
    if (data?.error === "photo_too_large") {
      setError(t("errorAttachmentTooLarge"));
    } else if (data?.error === "photo_invalid_type") {
      setError(t("errorAttachmentInvalidType"));
    } else {
      setError(t("errorGeneric"));
    }
  }

  async function toggleBlock() {
    const res = await fetch(`/api/users/${otherUserId}/block`, {
      method: blocked ? "DELETE" : "POST",
    });
    if (res.ok) {
      setBlocked(!blocked);
      router.refresh();
    }
  }

  const canSend = !blocked && !blockedByOther;

  return (
    <div>
      <div className="flex justify-end gap-4 mb-3">
        <DeleteConversationButton
          conversationId={conversationId}
          onDeleted={() => router.push("/compte/messages")}
        />
        <button type="button" onClick={toggleBlock} className="text-xs text-slate-500 hover:text-red-600">
          {blocked ? t("unblockUser") : t("blockUser")}
        </button>
        <ReportUserButton userId={otherUserId} isLoggedIn initialAlreadyReported={initialAlreadyReported} />
      </div>

      {!canSend ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 bg-slate-50 dark:bg-slate-800">
          {blocked ? t("blockedNotice") : t("blockedByOtherNotice")}
        </p>
      ) : (
        <form onSubmit={handleSend} className="space-y-2">
          {attachmentPreview && (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachmentPreview} alt="" className="h-16 w-16 rounded object-cover border border-slate-200 dark:border-slate-700" />
              <button
                type="button"
                onClick={removeAttachment}
                className="text-xs text-slate-500 hover:text-red-600"
              >
                {t("removeAttachment")}
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("typePlaceholder")}
              aria-label={t("typePlaceholder")}
              maxLength={2000}
              className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAttachmentChange}
              className="hidden"
              id="message-attachment-input"
            />
            <label
              htmlFor="message-attachment-input"
              className="flex items-center rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
              title={t("addAttachment")}
            >
              📎
              <span className="sr-only">{t("addAttachment")}</span>
            </label>
            <button
              type="submit"
              disabled={pending || (!content.trim() && !attachment)}
              className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {t("send")}
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
