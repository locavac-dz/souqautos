"use client";

import { useRouter } from "@/i18n/navigation";
import { useState } from "react";

export function MarkAllReadButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await fetch("/api/notifications/read-all", { method: "PATCH" }).catch(() => undefined);
    router.refresh();
    setPending(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-sm text-slate-600 dark:text-slate-400 underline disabled:opacity-50"
    >
      {label}
    </button>
  );
}
