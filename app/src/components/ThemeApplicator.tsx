"use client";

import { useEffect } from "react";

// Applique la classe .dark sur <html> au montage initial et en réponse
// aux changements de thème émis par ThemeToggle.
export function ThemeApplicator() {
  useEffect(() => {
    function apply() {
      let stored: string | null = null;
      try { stored = localStorage.getItem("souq-theme"); } catch {}
      const root = document.documentElement;
      if (stored === "dark") {
        root.classList.add("dark");
      } else if (stored === "light") {
        root.classList.remove("dark");
      } else {
        root.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
      }
    }

    apply();

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const mqHandler = () => {
      let stored: string | null = null;
      try { stored = localStorage.getItem("souq-theme"); } catch {}
      if (!stored || stored === "auto") {
        apply();
      }
    };
    mq.addEventListener("change", mqHandler);
    window.addEventListener("souq-theme-change", apply);
    return () => {
      mq.removeEventListener("change", mqHandler);
      window.removeEventListener("souq-theme-change", apply);
    };
  }, []);

  return null;
}
