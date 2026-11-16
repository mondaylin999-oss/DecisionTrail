"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Button } from "./ui";

const THEME_KEY = "decisiontrail-theme";

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    const initialIsDark = savedTheme
      ? savedTheme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;

    applyTheme(initialIsDark);
    setIsDark(initialIsDark);
  }, []);

  function toggleTheme() {
    const nextIsDark = !isDark;
    applyTheme(nextIsDark);
    window.localStorage.setItem(THEME_KEY, nextIsDark ? "dark" : "light");
    setIsDark(nextIsDark);
  }

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="shrink-0"
    >
      {t(isDark ? "Light mode" : "Dark mode")}
    </Button>
  );
}
