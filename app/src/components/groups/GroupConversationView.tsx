"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GroupMessageList, type GroupMessageRow } from "./GroupMessageList";
import { GroupMessageThread } from "./GroupMessageThread";
import { PushToggle } from "@/components/PushToggle";

type Member = { userId: string; userName: string; isAdmin: boolean };

type GroupDetail = {
  id: string;
  name: string;
  createdById: string;
  isAdmin: boolean;
  members: Member[];
};

type Props = {
  group: GroupDetail;
  initialMessages: GroupMessageRow[];
  currentUserId: string;
};

export function GroupConversationView({ group, initialMessages, currentUserId }: Props) {
  const t = useTranslations("Groups");
  const [messages, setMessages] = useState<GroupMessageRow[]>(initialMessages);
  const [addingMember, setAddingMember] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // SSE
  useEffect(() => {
    const es = new EventSource(`/api/groups/${group.id}/stream`);
    es.onmessage = (e) => {
      if (e.data === "ping") return;
      try {
        const event = JSON.parse(e.data);
        if (event.type === "message") {
          setMessages((prev) => {
            if (prev.some((m) => m.id === event.message.id)) return prev;
            return [...prev, event.message];
          });
        } else if (event.type === "delete") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === event.messageId
                ? { ...m, content: "", attachmentUrl: null, audioUrl: null, deletedAt: new Date() }
                : m
            )
          );
        }
      } catch {
        // ignore parse errors
      }
    };
    return () => es.close();
  }, [group.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSent(msg: GroupMessageRow) {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }

  function handleDeleted(messageId: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, content: "", attachmentUrl: null, audioUrl: null, deletedAt: new Date() }
          : m
      )
    );
  }

  async function handleAddMember() {
    setMemberError(null);
    const email = memberEmail.trim();
    if (!email) return;

    // Résoudre l'email en userId via une recherche légère
    const res = await fetch(`/api/groups/${group.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data?.error === "not_found") setMemberError(t("memberNotFound", { email }));
      else if (data?.error === "max_members") setMemberError(t("maxMembersError"));
      else setMemberError(t("errorGeneric"));
      return;
    }
    setMemberEmail("");
    setAddingMember(false);
  }

  async function handleLeave() {
    if (!leaving) { setLeaving(true); return; }
    const res = await fetch(`/api/groups/${group.id}/members/${currentUserId}`, { method: "DELETE" });
    if (res.ok) window.location.href = "/compte/groupes";
    else setLeaving(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* En-tête groupe */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{group.name}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t("memberCount", { count: group.members.length })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PushToggle compact />
          {group.isAdmin && (
            <button type="button" onClick={() => setAddingMember((v) => !v)}
              className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
              {t("addMember")}
            </button>
          )}
          <button type="button" onClick={handleLeave}
            className={`text-xs ${leaving ? "text-red-600 font-medium" : "text-slate-500 dark:text-slate-400 hover:underline"}`}>
            {leaving ? t("confirmLeave") : t("leave")}
          </button>
        </div>
      </div>

      {/* Formulaire ajout membre */}
      {addingMember && group.isAdmin && (
        <div className="mb-4 flex gap-2">
          <input
            type="email"
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            placeholder={t("addMemberEmail")}
            className="flex-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button type="button" onClick={handleAddMember}
            className="rounded bg-teal-700 px-3 py-1.5 text-sm text-white hover:bg-teal-800">
            {t("add")}
          </button>
        </div>
      )}
      {memberError && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{memberError}</p>}

      {/* Liste messages */}
      <div className="flex-1 overflow-y-auto">
        <GroupMessageList
          groupId={group.id}
          messages={messages}
          currentUserId={currentUserId}
          onDeleted={handleDeleted}
        />
        <div ref={bottomRef} />
      </div>

      {/* Formulaire d'envoi */}
      <GroupMessageThread groupId={group.id} onSent={handleSent} />
    </div>
  );
}
