"use client";

import { useEffect } from "react";
import { saveRecentlyViewed, type RecentlyViewedEntry } from "@/lib/recently-viewed";

export function RecentlyViewedTracker({ entry }: { entry: RecentlyViewedEntry }) {
  useEffect(() => {
    saveRecentlyViewed({ ...entry, viewedAt: Date.now() });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  return null;
}
