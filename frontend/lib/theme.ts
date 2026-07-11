import type { ThemeValue } from "@/lib/types";

export function applyTheme(theme: ThemeValue) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (theme === "default") {
    root.classList.toggle("dark", prefersDark);
  } else if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function getStoredTheme(): ThemeValue {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark" || stored === "default") {
    return stored;
  }
  return "default";
}

export function setStoredTheme(theme: ThemeValue) {
  localStorage.setItem("theme", theme);
  applyTheme(theme);
}

export function initTheme() {
  if (!("theme" in localStorage)) {
    localStorage.setItem("theme", "default");
  }
  applyTheme(getStoredTheme());
}
