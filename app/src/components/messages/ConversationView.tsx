"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageList } from "./MessageList";
import { MessageThread } from "./MessageThread";

type MessageRow = {
  id: string;
  senderId: string;
  content: string;
  attachmentUrl: string | null;
  audioUrl: string | null;
  deletedAt: Date | null;
};

type ApiMessageRow = {
  id: string;
  senderId: string;
  content: string;
  attachmentUrl: string | null;
  audioUrl: string | null;
  deletedAt: string | null;
};

type ConversationEvent =
  | { type: "message"; message: Omit<MessageRow, "deletedAt"> & { deletedAt: null; createdAt: string } }
  | { type: "delete"; messageId: string };

// Lot 40 — messagerie en temps réel : ce composant est le seul point qui
// détient l'état des messages ; MessageThread ne fait plus un router.refresh()
// après l'envoi, il attend l'écho du flux SSE (comme tout autre événement
// entrant), garantissant que l'expéditeur et le destinataire voient toujours
// exactement la même séquence de messages.
export function ConversationView({
  conversationId,
  initialMessages,
  initialHasMore,
  currentUserId,
  otherUserId,
  initialBlocked,
  blockedByOther,
  initialAlreadyReported,
}: {
  conversationId: string;
  initialMessages: MessageRow[];
  initialHasMore: boolean;
  currentUserId: string;
  otherUserId: string;
  initialBlocked: boolean;
  blockedByOther: boolean;
  initialAlreadyReported: boolean;
}) {
  const t = useTranslations("Messages");
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  // Scroll restoration when prepending history (window-level scroll)
  const prevScrollHeightRef = useRef<number>(0);
  const preserveScrollRef = useRef<boolean>(false);

  useEffect(() => {
    const source = new EventSource(`/api/conversations/${conversationId}/stream`);

    source.onmessage = (event) => {
      const data: ConversationEvent = JSON.parse(event.data);

      if (data.type === "message") {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, { ...data.message, deletedAt: null }];
        });
        if (data.message.senderId !== currentUserId) {
          fetch(`/api/conversations/${conversationId}/read`, { method: "POST" }).catch(() => {});
        }
      } else if (data.type === "delete") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId
              ? { ...m, content: "", attachmentUrl: null, audioUrl: null, deletedAt: new Date() }
              : m
          )
        );
      }
    };

    return () => source.close();
  }, [conversationId, currentUserId]);

  // Restore window scroll position after prepending old messages
  useLayoutEffect(() => {
    if (!preserveScrollRef.current) return;
    preserveScrollRef.current = false;
    window.scrollBy(0, document.documentElement.scrollHeight - prevScrollHeightRef.current);
  }, [messages]);

  async function handleLoadMore() {
    if (loadingMore || !hasMore || !messages.length) return;
    setLoadingMore(true);
    const oldest = messages[0];
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages?before=${oldest.id}`);
      if (!res.ok) return;
      const data: { messages: ApiMessageRow[]; hasMore: boolean } = await res.json();

      prevScrollHeightRef.current = document.documentElement.scrollHeight;
      preserveScrollRef.current = true;

      setMessages((prev) => [
        ...data.messages.map((m) => ({ ...m, deletedAt: m.deletedAt ? new Date(m.deletedAt) : null })),
        ...prev,
      ]);
      setHasMore(data.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleSent(message: Omit<MessageRow, "deletedAt">) {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, { ...message, deletedAt: null }];
    });
  }

  function handleDeleted(messageId: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, content: "", attachmentUrl: null, audioUrl: null, deletedAt: new Date() } : m))
    );
  }

  return (
    <>
      {hasMore && (
        <div className="flex justify-center mt-6 mb-2">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="text-xs text-teal-700 dark:text-teal-400 hover:underline disabled:opacity-50"
          >
            {loadingMore ? "…" : t("loadMoreMessages")}
          </button>
        </div>
      )}

      <div className="mt-2" aria-live="polite" aria-relevant="additions">
        <MessageList
          conversationId={conversationId}
          messages={messages}
          currentUserId={currentUserId}
          onDeleted={handleDeleted}
        />
      </div>

      <MessageThread
        conversationId={conversationId}
        otherUserId={otherUserId}
        initialBlocked={initialBlocked}
        blockedByOther={blockedByOther}
        initialAlreadyReported={initialAlreadyReported}
        onSent={handleSent}
      />
    </>
  );
}
