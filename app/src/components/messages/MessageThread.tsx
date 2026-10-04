"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { DeleteConversationButton } from "./DeleteConversationButton";
import { ReportUserButton } from "@/components/ReportUserButton";

const MAX_RECORDING_SECONDS = 120;

type SentMessage = {
  id: string;
  senderId: string;
  content: string;
  attachmentUrl: string | null;
  audioUrl: string | null;
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

  // — Enregistrement vocal (Lot 251) —
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const audioPreviewUrl = useMemo(
    () => (audioBlob ? URL.createObjectURL(audioBlob) : null),
    [audioBlob]
  );
  useEffect(() => {
    return () => {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    };
  }, [audioPreviewUrl]);

  // Nettoyage à la destruction du composant si l'enregistrement est encore actif
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

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

  async function startRecording() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(t("voicePermissionDenied"));
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg;codecs=opus";

    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      setAudioBlob(blob);
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(250); // chunks toutes les 250 ms pour ne pas perdre de données si la page se ferme
    setRecording(true);
    setRecordingSeconds(0);

    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => {
        if (prev + 1 >= MAX_RECORDING_SECONDS) {
          stopRecording();
          return prev + 1;
        }
        return prev + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  function discardVoice() {
    setAudioBlob(null);
    setRecordingSeconds(0);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && !attachment && !audioBlob) return;
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("content", content.trim());
    if (attachment) formData.set("attachment", attachment);
    if (audioBlob) {
      const ext = audioBlob.type.includes("ogg") ? ".ogg" : audioBlob.type.includes("mp4") ? ".mp4" : ".webm";
      formData.set("voice", audioBlob, `voice${ext}`);
    }

    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: formData,
    });

    setPending(false);

    if (res.ok) {
      const data = await res.json();
      setContent("");
      removeAttachment();
      discardVoice();
      onSent?.(data.message);
      return;
    }

    const data = await res.json().catch(() => null);
    if (data?.error === "photo_too_large") {
      setError(t("errorAttachmentTooLarge"));
    } else if (data?.error === "photo_invalid_type") {
      setError(t("errorAttachmentInvalidType"));
    } else if (data?.error === "voice_too_large") {
      setError(t("voiceTooLarge"));
    } else if (data?.error === "voice_invalid_type") {
      setError(t("voiceInvalidType"));
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
  const mm = String(Math.floor(recordingSeconds / 60)).padStart(2, "0");
  const ss = String(recordingSeconds % 60).padStart(2, "0");

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
          {/* Aperçu de l'image jointe */}
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

          {/* Aperçu du message vocal enregistré */}
          {audioBlob && audioPreviewUrl && (
            <div className="flex items-center gap-3 rounded-md border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950 px-3 py-2">
              <audio controls src={audioPreviewUrl} aria-label={t("voicePreviewLabel")} className="max-w-[200px]" />
              <button
                type="button"
                onClick={discardVoice}
                className="text-xs text-slate-500 hover:text-red-600 shrink-0"
              >
                {t("voiceDiscard")}
              </button>
            </div>
          )}

          {/* Interface d'enregistrement en cours */}
          {recording && (
            <div className="flex items-center gap-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2">
              <span className="flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span className="text-sm text-red-700 dark:text-red-300 font-mono">{mm}:{ss}</span>
              <button
                type="button"
                onClick={stopRecording}
                className="ml-auto text-xs rounded-md border border-red-300 dark:border-red-700 px-2 py-1 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900"
              >
                {t("voiceStop")}
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
              disabled={recording}
              className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm disabled:opacity-50"
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
              className={`flex items-center rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer ${recording ? "pointer-events-none opacity-50" : ""}`}
              title={t("addAttachment")}
            >
              📎
              <span className="sr-only">{t("addAttachment")}</span>
            </label>

            {/* Bouton micro — visible seulement si pas de message vocal déjà prêt */}
            {!audioBlob && (
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={pending}
                title={t("voiceRecord")}
                className={`flex items-center rounded-md border px-3 py-2 text-sm disabled:opacity-50 ${
                  recording
                    ? "border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900"
                    : "border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                🎤
                <span className="sr-only">{t("voiceRecord")}</span>
              </button>
            )}

            <button
              type="submit"
              disabled={pending || recording || (!content.trim() && !attachment && !audioBlob)}
              className="rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {t("send")}
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
