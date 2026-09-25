"use client";

import { useRouter } from "@/i18n/navigation";

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
    >
      {label}
    </button>
  );
}
