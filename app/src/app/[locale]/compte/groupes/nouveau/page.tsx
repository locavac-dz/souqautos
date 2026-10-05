"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";

export default function NewGroupPage() {
  const t = useTranslations("Groups");
  const router = useRouter();
  const [name, setName] = useState("");
  const [emails, setEmails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const memberEmails = emails.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!name.trim() || memberEmails.length === 0) return;

    // Résoudre les emails en IDs via une route dédiée
    setSubmitting(true);
    const lookupRes = await fetch("/api/users/lookup-by-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: memberEmails }),
    });
    if (!lookupRes.ok) {
      setSubmitting(false);
      setError(t("errorGeneric"));
      return;
    }
    const { users, notFound } = await lookupRes.json();
    if (notFound?.length) {
      setSubmitting(false);
      setError(t("memberNotFound", { email: notFound[0] }));
      return;
    }

    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), memberIds: users.map((u: { id: string }) => u.id) }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data?.error === "invalid_members") setError(t("memberNotFound", { email: "?" }));
      else setError(t("errorGeneric"));
      return;
    }
    const { group } = await res.json();
    router.push(`/compte/groupes/${group.id}`);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Link href="/compte/groupes" className="text-sm text-slate-500 hover:underline dark:text-slate-400 mb-6 block">
        ← {t("back")}
      </Link>

      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">{t("createGroup")}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("groupName")}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("groupNamePlaceholder")}
            maxLength={80}
            required
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("members")}</label>
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder={t("membersPlaceholder")}
            rows={4}
            required
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={submitting || !name.trim() || !emails.trim()}
            className="flex-1 rounded-lg bg-teal-700 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
            {t("create")}
          </button>
          <Link href="/compte/groupes"
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 py-2 text-center text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
            {t("cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
