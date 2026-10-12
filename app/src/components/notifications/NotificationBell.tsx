"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [lastInitialCount, setLastInitialCount] = useState(initialCount);
  const esRef = useRef<EventSource | null>(null);
  const t = useTranslations("Nav");

  // Le compte serveur change (navigation) : on s'y recale PENDANT le rendu, motif recommandé par React plutôt qu'un
  // setState dans un effet (rendu en cascade, règle react-hooks/set-state-in-effect).
  if (initialCount !== lastInitialCount) {
    setLastInitialCount(initialCount);
    setCount(initialCount);
  }

  useEffect(() => {
    const es = new EventSource("/api/notifications/stream");
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type: string; count: number };
        if (typeof data.count === "number") {
          setCount(data.count);
        }
      } catch {
        // heartbeat or malformed — ignore
      }
    };

    es.onerror = () => {
      es.close();
      // Reconnect after 5s on error
      const timer = setTimeout(() => {
        if (esRef.current === es) {
          esRef.current = null;
          // Re-trigger the effect by forcing a re-render is complex,
          // so we just create a new EventSource inline.
          const reconnected = new EventSource("/api/notifications/stream");
          esRef.current = reconnected;
          reconnected.onmessage = es.onmessage;
          reconnected.onerror = es.onerror;
        }
      }, 5000);
      return () => clearTimeout(timer);
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  return (
    <Link
      href="/compte/notifications"
      className="relative flex items-center justify-center w-8 h-8 rounded-md text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      aria-label={`${t("notifications")}${count > 0 ? ` (${count})` : ""}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
        aria-hidden="true"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-0.5 -end-0.5 flex items-center justify-center min-w-[1.1rem] h-[1.1rem] rounded-full bg-red-600 text-white text-[0.6rem] font-bold px-1 leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
