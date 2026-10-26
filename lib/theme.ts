"use client";

export type Theme = "dark" | "light";
export type Accent = "emerald" | "cyan" | "violet" | "amber";

const STORAGE_KEY = "pulseboard-theme";
const ACCENT_KEY = "pulseboard-accent";
const listeners = new Set<() => void>();
const accentListeners = new Set<() => void>();
let cachedTheme: Theme | null = null;
let cachedAccent: Accent | null = null;

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

function isAccent(value: string | null): value is Accent {
  return value === "emerald" || value === "cyan" || value === "violet" || value === "amber";
}

function readStoredAccent(): Accent {
  try {
    const stored = window.localStorage.getItem(ACCENT_KEY);
    return isAccent(stored) ? stored : "emerald";
  } catch {
    return "emerald";
  }
}

function applyAccent(accent: Accent): void {
  document.documentElement.dataset.accent = accent;
}

export function getAccentSnapshot(): Accent {
  cachedAccent ??= readStoredAccent();
  return cachedAccent;
}

export function getAccentServerSnapshot(): Accent {
  return "emerald";
}

export function subscribeAccent(listener: () => void): () => void {
  accentListeners.add(listener);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== ACCENT_KEY) return;
    cachedAccent = isAccent(event.newValue) ? event.newValue : "emerald";
    applyAccent(cachedAccent);
    listener();
  };

  window.addEventListener("storage", handleStorage);
  return () => {
    accentListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function setAccent(accent: Accent): void {
  cachedAccent = accent;
  applyAccent(accent);

  try {
    window.localStorage.setItem(ACCENT_KEY, accent);
  } catch {
    // Storage can be unavailable in private or restricted contexts.
  }

  for (const listener of accentListeners) listener();
}
