"use client";

import { useEffect, useState } from "react";
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
  currentUserId,
  otherUserId,
  initialBlocked,
  blockedByOther,
  initialAlreadyReported,
}: {
  conversationId: string;
  initialMessages: MessageRow[];
  currentUserId: string;
  otherUserId: string;
  initialBlocked: boolean;
  blockedByOther: boolean;
  initialAlreadyReported: boolean;
}) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);

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
      <div className="mt-6" aria-live="polite" aria-relevant="additions">
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
