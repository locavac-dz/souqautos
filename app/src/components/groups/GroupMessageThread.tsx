"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  groupId: string;
  onSent: (msg: {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    attachmentUrl: string | null;
    audioUrl: string | null;
    deletedAt: null;
    createdAt: string;
  }) => void;
};

export function GroupMessageThread({ groupId, onSent }: Props) {
  const t = useTranslations("Groups");
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
    e.target.value = "";
  }

  function removeImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => {
          if (s >= 119) { mr.stop(); clearInterval(timerRef.current!); setRecording(false); return 120; }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError(t("voicePermissionDenied"));
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }

  function discardAudio() {
    setAudioBlob(null);
    setRecordingSeconds(0);
  }

  async function handleSend() {
    if (!text.trim() && !imageFile && !audioBlob) return;
    setSending(true);
    setError(null);
    const fd = new FormData();
    if (text.trim()) fd.append("content", text.trim());
    if (imageFile) fd.append("attachment", imageFile);
    if (audioBlob) {
      const ext = audioBlob.type.includes("ogg") ? ".ogg" : audioBlob.type.includes("mp4") ? ".mp4" : ".webm";
      fd.append("voice", audioBlob, `voice${ext}`);
    }
    const res = await fetch(`/api/groups/${groupId}/messages`, { method: "POST", body: fd });
    setSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data?.error === "voice_too_large") setError(t("voiceTooLarge"));
      else setError(t("errorGeneric"));
      return;
    }
    const data = await res.json();
    setText("");
    removeImage();
    discardAudio();
    onSent(data.message);
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {imagePreview && (
        <div className="relative w-20 h-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt={t("attachmentAlt")} className="w-20 h-20 object-cover rounded" />
          <button type="button" onClick={removeImage} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-800 text-white text-xs flex items-center justify-center">×</button>
        </div>
      )}

      {audioBlob && !recording && (
        <div className="flex items-center gap-2">
          <audio controls src={URL.createObjectURL(audioBlob)} className="h-8 flex-1" />
          <button type="button" onClick={discardAudio} className="text-xs text-red-500 hover:text-red-700">{t("voiceDiscard")}</button>
        </div>
      )}

      {recording && (
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>{fmt(recordingSeconds)}</span>
          <button type="button" onClick={stopRecording} className="ml-2 text-xs underline">{t("voiceStop")}</button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={t("typePlaceholder")}
          disabled={sending || recording}
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
        />

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={sending || recording} title={t("addAttachment")}
          className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-40">
          📎
        </button>

        {!audioBlob && (
          <button type="button" onClick={recording ? stopRecording : startRecording} disabled={sending} title={recording ? t("voiceStop") : t("voiceRecord")}
            className={`p-2 disabled:opacity-40 ${recording ? "text-red-500" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            🎤
          </button>
        )}

        <button type="button" onClick={handleSend} disabled={sending || recording || (!text.trim() && !imageFile && !audioBlob)}
          className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40">
          {t("send")}
        </button>
      </div>
    </div>
  );
}
