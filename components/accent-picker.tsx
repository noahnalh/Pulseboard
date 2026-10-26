"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Palette } from "lucide-react";
import {
  getAccentServerSnapshot,
  getAccentSnapshot,
  setAccent,
  subscribeAccent,
  type Accent,
} from "@/lib/theme";
import { cn } from "@/lib/format";

const ACCENTS: Array<{ value: Accent; label: string; color: string }> = [
  { value: "emerald", label: "Emerald", color: "#34d399" },
  { value: "cyan", label: "Cyan", color: "#22d3ee" },
  { value: "violet", label: "Violet", color: "#a78bfa" },
  { value: "amber", label: "Amber", color: "#fbbf24" },
];

export function AccentPicker() {
  const accent = useSyncExternalStore(
    subscribeAccent,
    getAccentSnapshot,
    getAccentServerSnapshot,
  );
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Choose accent color"
        aria-expanded={open}
        title="Accent color"
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-edge bg-ink-850 text-slate-400 transition-colors hover:border-edge-bright hover:bg-ink-800 hover:text-white"
      >
        <Palette className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[168px] rounded-xl border border-edge-bright bg-ink-900/95 p-2 shadow-[0_20px_60px_-24px_var(--tooltip-shadow)] backdrop-blur">
          <p className="px-1.5 pb-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-slate-600">
            Accent
          </p>
          <div className="grid grid-cols-2 gap-1">
            {ACCENTS.map((option) => {
              const active = option.value === accent;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setAccent(option.value);
                    setOpen(false);
                  }}
                  aria-pressed={active}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-md px-2 text-[10px] transition-colors",
                    active
                      ? "bg-white/[0.06] text-slate-200"
                      : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300",
                  )}
                >
                  <span
                    className="flex h-3.5 w-3.5 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: option.color,
                      boxShadow: `0 0 12px ${option.color}66`,
                    }}
                  >
                    {active ? <Check className="h-2.5 w-2.5 text-ink-950" /> : null}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
