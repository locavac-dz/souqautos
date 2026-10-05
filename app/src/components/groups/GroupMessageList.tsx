"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export type GroupMessageRow = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  attachmentUrl: string | null;
  audioUrl: string | null;
  deletedAt: Date | null;
  createdAt: string;
};

export function GroupMessageList({
  groupId,
  messages,
  currentUserId,
  onDeleted,
}: {
  groupId: string;
  messages: GroupMessageRow[];
  currentUserId: string;
  onDeleted?: (messageId: string) => void;
}) {
  const t = useTranslations("Groups");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function handleDelete(messageId: string) {
    if (confirmingId !== messageId) {
      setConfirmingId(messageId);
      return;
    }
    setPendingId(messageId);
    const res = await fetch(`/api/groups/${groupId}/messages/${messageId}`, { method: "DELETE" });
    setPendingId(null);
    setConfirmingId(null);
    if (res.ok) onDeleted?.(messageId);
  }

  return (
    <div className="space-y-1 mb-6">
      {messages.map((message, index) => {
        const isMine = message.senderId === currentUserId;
        const isDeleted = Boolean(message.deletedAt);
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const showSender = !isMine && (!prevMessage || prevMessage.senderId !== message.senderId || prevMessage.deletedAt);

        return (
          <div key={message.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"} ${showSender ? "mt-3" : "mt-0.5"}`}>
            {showSender && (
              <p className="text-xs text-slate-500 dark:text-slate-400 px-1 mb-0.5">{message.senderName}</p>
            )}
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
