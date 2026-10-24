"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import {
  getThemeServerSnapshot,
  getThemeSnapshot,
  subscribeTheme,
  toggleTheme,
} from "@/lib/theme";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  const next = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-edge bg-ink-850 text-slate-400 transition-colors hover:border-edge-bright hover:bg-ink-800 hover:text-white"
    >
      <Sun className="hidden h-3.5 w-3.5 text-amber-400 light:block" />
      <Moon className="h-3.5 w-3.5 light:hidden" />
    </button>
  );
}
