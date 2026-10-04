"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type MessageRow = {
  id: string;
  senderId: string;
  content: string;
  attachmentUrl: string | null;
  audioUrl: string | null;
  deletedAt: Date | null;
};

export function MessageList({
  conversationId,
  messages,
  currentUserId,
  onDeleted,
}: {
  conversationId: string;
  messages: MessageRow[];
  currentUserId: string;
  onDeleted?: (messageId: string) => void;
}) {
  const t = useTranslations("Messages");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function handleDelete(messageId: string) {
    if (confirmingId !== messageId) {
      setConfirmingId(messageId);
      return;
    }
    setPendingId(messageId);
    const res = await fetch(`/api/conversations/${conversationId}/messages/${messageId}`, {
      method: "DELETE",
    });
    setPendingId(null);
    setConfirmingId(null);
    if (res.ok) {
      onDeleted?.(messageId);
    }
  }

  return (
    <div className="space-y-3 mb-6">
      {messages.map((message) => {
        const isMine = message.senderId === currentUserId;
        const isDeleted = Boolean(message.deletedAt);
        return (
          <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
            <div className="flex flex-col items-end gap-1 max-w-[80%]">
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  isDeleted
                    ? "italic text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    : isMine
                      ? "bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                }`}
              >
                {isDeleted ? (
                  t("messageDeleted")
                ) : (
                  <>
                    {message.attachmentUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={message.attachmentUrl}
                        alt={t("attachmentAlt")}
                        className="max-w-full max-h-64 rounded mb-1 block"
                      />
                    )}
                    {message.audioUrl && (
                      <audio
                        controls
                        src={message.audioUrl}
                        aria-label={t("voicePreviewLabel")}
                        className="max-w-[260px] mb-1 block"
                      />
                    )}
                    {message.content}
                  </>
                )}
              </div>
              {isMine && !isDeleted && (
                <button
                  type="button"
                  onClick={() => handleDelete(message.id)}
                  disabled={pendingId === message.id}
                  className="text-xs text-slate-500 hover:text-red-600 disabled:opacity-50"
                >
                  {confirmingId === message.id ? t("confirmDeleteMessage") : t("deleteMessage")}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
