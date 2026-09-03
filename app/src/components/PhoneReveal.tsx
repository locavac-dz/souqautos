"use client";

import { useState } from "react";

export function PhoneReveal({ phone, label }: { phone: string; label: string }) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) {
    return (
      <a
        href={`tel:${phone}`}
        className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        {phone}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
    >
      {label}
    </button>
  );
}
