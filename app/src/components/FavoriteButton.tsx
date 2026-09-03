"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

export function FavoriteButton({
  listingId,
  initialFavorited,
  isLoggedIn,
  label,
}: {
  listingId: string;
  initialFavorited: boolean;
  isLoggedIn: boolean;
  label: string;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn) {
      router.push("/connexion");
      return;
    }

    setPending(true);
    const res = await fetch(`/api/favorites/${listingId}`, {
      method: favorited ? "DELETE" : "POST",
    });
    if (res.ok) setFavorited(!favorited);
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorited}
      aria-label={label}
      title={label}
      className="flex items-center justify-center h-9 w-9 rounded-full bg-white/90 border border-slate-200 shadow-sm hover:bg-white disabled:opacity-60"
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-5 w-5 ${favorited ? "fill-red-500 stroke-red-500" : "fill-none stroke-slate-500"}`}
        strokeWidth={1.8}
      >
        <path d="M12 20.5s-7.5-4.8-10-9.4C.4 7.6 2 4 5.6 4c2 0 3.4 1 4.4 2.4C11 5 12.4 4 14.4 4 18 4 19.6 7.6 22 11.1c-2.5 4.6-10 9.4-10 9.4Z" />
      </svg>
    </button>
  );
}
