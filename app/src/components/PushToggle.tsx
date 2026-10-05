"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { decidePushState, urlBase64ToUint8Array, type PushToggleState } from "@/lib/push-client";

type Message = { kind: "ok" | "error"; text: string };

// Lot 121 — activer ou couper les notifications d'alerte sur CET appareil.
// compact=true : icône cloche seule (pour les en-têtes étroits comme les conversations de groupe).
export function PushToggle({ compact = false }: { compact?: boolean } = {}) {
  const t = useTranslations("PushNotifications");
  const [state, setState] = useState<PushToggleState>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      let serverEnabled = false;
      let key: string | null = null;
      try {
        const config = await (await fetch("/api/push/config")).json();
        serverEnabled = Boolean(config?.enabled);
        key = config?.publicKey ?? null;
      } catch {
        /* serveur injoignable : la fonction est présentée comme indisponible */
      }

      let hasWorker = false;
      let subscribed = false;
      if (supported) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        hasWorker = Boolean(registration);
        subscribed = Boolean(registration && (await registration.pushManager.getSubscription()));
      }

      if (cancelled) return;
      setPublicKey(key);
      setState(
        decidePushState({
          supported,
          serverEnabled,
          hasWorker,
          permission: supported ? Notification.permission : "default",
          subscribed,
        })
      );
    }

    void detect();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!publicKey) return;
    setPending(true);
    setMessage(null);
    try {
      // La permission se demande ici, à la demande de la personne : jamais dès l'ouverture de la page.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) {
        await subscription.unsubscribe(); // pas d'abonnement local que le serveur ne connaît pas
        setMessage({ kind: "error", text: t("errorGeneric") });
        return;
      }
      setState("on");
    } catch {
      setMessage({ kind: "error", text: t("errorGeneric") });
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setPending(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
    } catch {
      setMessage({ kind: "error", text: t("errorGeneric") });
    } finally {
      setPending(false);
    }
  }

  async function sendTest() {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.status === 429) setMessage({ kind: "error", text: t("testRateLimited") });
      else if (!res.ok) setMessage({ kind: "error", text: t("errorGeneric") });
      else if (data?.sent > 0) setMessage({ kind: "ok", text: t("testSent") });
      else setMessage({ kind: "error", text: t("testNoDelivery") });
    } catch {
      setMessage({ kind: "error", text: t("errorGeneric") });
    } finally {
      setPending(false);
    }
  }

  if (state === "loading") return null;

  // Mode compact : une simple icône cloche pour les en-têtes étroits.
  if (compact) {
    if (state === "off") {
      return (
        <button type="button" onClick={enable} disabled={pending} title={t("enable")}
          className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 disabled:opacity-40 text-base leading-none">
          🔔
        </button>
      );
    }
    if (state === "on") {
      return (
        <button type="button" onClick={disable} disabled={pending} title={t("disable")}
          className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 disabled:opacity-40 text-base leading-none">
          🔔
        </button>
      );
    }
    return null;
  }

  return (
    <section className="mb-6 rounded-lg border border-slate-200 dark:border-slate-700 p-4" aria-labelledby="push-title">
      <h2 id="push-title" className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {t("title")}
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("help")}</p>

      {state === "off" && (
        <button
          type="button"
          onClick={enable}
          disabled={pending}
          className="mt-3 rounded-md bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {t("enable")}
        </button>
      )}

      {state === "on" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-emerald-700">{t("statusOn")}</span>
          <button type="button" onClick={sendTest} disabled={pending} className="text-sm text-slate-700 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-50">
            {t("test")}
          </button>
          <button type="button" onClick={disable} disabled={pending} className="text-sm text-red-600 hover:underline disabled:opacity-50">
            {t("disable")}
          </button>
        </div>
      )}

      {state === "denied" && <p className="mt-3 text-sm text-amber-700">{t("denied")}</p>}
      {state === "unsupported" && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{t("unsupported")}</p>}
      {state === "unavailable" && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{t("unavailable")}</p>}
      {state === "no-worker" && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{t("noWorker")}</p>}

      {message && (
        <p role="status" className={`mt-2 text-sm ${message.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
