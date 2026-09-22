"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function FollowProButton({
  proAccountId,
  initialFollowing,
  isLoggedIn,
}: {
  proAccountId: string;
  initialFollowing: boolean;
  isLoggedIn: boolean;
}) {
  const t = useTranslations("Pro");
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!isLoggedIn) {
      router.push("/connexion");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/pro/${proAccountId}/follow`, {
        method: following ? "DELETE" : "POST",
      });
      if (res.ok) setFollowing(!following);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-pressed={following}
      className={
        following
          ? "flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50"
          : "flex items-center gap-1.5 rounded-full border border-slate-900 bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      }
    >
      {following ? (
        <>
          <span aria-hidden>✓</span>
          {t("unfollowButton")}
        </>
      ) : (
        <>
          <span aria-hidden>+</span>
          {t("followButton")}
        </>
      )}
    </button>
  );
}
