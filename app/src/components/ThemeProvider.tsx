"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "auto";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "auto",
  setTheme: () => {},
  isDark: false,
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyTheme(theme: Theme): boolean {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    return true;
  }
  if (theme === "light") {
    root.classList.remove("dark");
    return false;
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.classList.toggle("dark", prefersDark);
  return prefersDark;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("auto");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("souq-theme");
    const initial: Theme = stored === "light" || stored === "dark" ? stored : "auto";
    setThemeState(initial);
    setIsDark(applyTheme(initial));
  }, []);

  // Re-register the system-preference listener whenever theme flips to/from auto
  useEffect(() => {
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
      setIsDark(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem("souq-theme", t);
    setIsDark(applyTheme(t));
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}
