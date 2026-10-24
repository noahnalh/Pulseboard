"use client";

export type Theme = "dark" | "light";

const STORAGE_KEY = "pulseboard-theme";
const listeners = new Set<() => void>();
let cachedTheme: Theme | null = null;

function readStoredTheme(): Theme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#eef2f7" : "#04060a");
}

export function getThemeSnapshot(): Theme {
  cachedTheme ??= readStoredTheme();
  return cachedTheme;
}

export function getThemeServerSnapshot(): Theme {
  return "dark";
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cachedTheme = event.newValue === "light" ? "light" : "dark";
    applyTheme(cachedTheme);
    listener();
  };

  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function setTheme(theme: Theme): void {
  cachedTheme = theme;
  applyTheme(theme);

  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in private or restricted contexts.
  }

  for (const listener of listeners) listener();
}

export function toggleTheme(): void {
  setTheme(getThemeSnapshot() === "light" ? "dark" : "light");
}
