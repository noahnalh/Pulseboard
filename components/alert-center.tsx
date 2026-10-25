"use client";

import { useEffect, useRef } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  Gauge,
  ShieldAlert,
  Timer,
  X,
  Zap,
} from "lucide-react";
import { cn, formatInteger, formatLatency, formatUptime } from "@/lib/format";
import type { AlertRule, AlertState, TelemetryAlert } from "@/lib/types";

interface AlertCenterProps {
  open: boolean;
  alerts: AlertState | null;
  onClose: () => void;
  onAcknowledge: (id: string) => void;
}

const RULES: Array<{ rule: AlertRule; label: string; icon: typeof Gauge }> = [
  { rule: "error-rate", label: "5xx rate", icon: AlertTriangle },
  { rule: "latency-p95", label: "p95 latency", icon: Timer },
  { rule: "throughput-surge", label: "Throughput", icon: Zap },
];

function alertValue(alert: TelemetryAlert): string {
  if (alert.rule === "error-rate") return `${alert.value.toFixed(1)}%`;
  if (alert.rule === "latency-p95") return formatLatency(alert.value);
  return `${formatInteger(alert.value)} ev/s`;
}

function alertThreshold(alert: TelemetryAlert): string {
  if (alert.rule === "error-rate") return `${alert.threshold.toFixed(1)}%`;
  if (alert.rule === "latency-p95") return formatLatency(alert.threshold);
  return `${formatInteger(alert.threshold)} ev/s`;
}

function ruleLabel(rule: AlertRule): string {
  return RULES.find((entry) => entry.rule === rule)?.label ?? rule;
}

function RuleIcon({ rule, className }: { rule: AlertRule; className?: string }) {
  const Icon = RULES.find((entry) => entry.rule === rule)?.icon ?? Activity;
  return <Icon className={className} />;
}

function SeverityPill({ alert }: { alert: TelemetryAlert }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em]",
        alert.severity === "critical"
          ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
          : "border-amber-400/25 bg-amber-400/10 text-amber-300",
      )}
    >
      <span
        className={cn(
          "h-1 w-1 rounded-full",
          alert.severity === "critical" ? "bg-rose-400" : "bg-amber-400",
        )}
      />
      {alert.severity}
    </span>
  );
}

function ActiveAlert({
  alert,
  onAcknowledge,
}: {
  alert: TelemetryAlert;
  onAcknowledge: (id: string) => void;
}) {
  return (
    <li className="rounded-xl border border-edge/80 bg-ink-850/70 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
              alert.severity === "critical"
                ? "border-rose-400/20 bg-rose-400/10 text-rose-300"
                : "border-amber-400/20 bg-amber-400/10 text-amber-300",
            )}
          >
            <RuleIcon rule={alert.rule} className="h-3 w-3" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-slate-200">{alert.title}</p>
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">
              {ruleLabel(alert.rule)} · {formatUptime((alert.updatedAt - alert.startedAt) / 1_000)}
            </p>
          </div>
        </div>
        <SeverityPill alert={alert} />
      </div>

      <p className="mt-2.5 text-[11px] leading-4 text-slate-500">{alert.detail}</p>

      <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-edge/60 pt-2.5">
        <span className="font-mono text-[9px] text-slate-600">
          value <span className="text-slate-300">{alertValue(alert)}</span> · threshold{" "}
          {alertThreshold(alert)}
        </span>
        {alert.acknowledgedAt ? (
          <span className="inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.12em] text-emerald-400">
            <Check className="h-3 w-3" />
            acknowledged
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onAcknowledge(alert.id)}
            className="inline-flex h-6 items-center gap-1 rounded border border-edge bg-ink-800 px-2 font-mono text-[9px] text-slate-300 transition-colors hover:border-edge-bright hover:text-white"
          >
            <Check className="h-3 w-3" />
            Ack
          </button>
        )}
      </div>
    </li>
  );
}

function RecentAlert({ alert }: { alert: TelemetryAlert }) {
  return (
    <li className="flex items-start gap-2.5 border-b border-edge/40 py-2.5 last:border-0">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-edge bg-ink-850 text-slate-500">
        <RuleIcon rule={alert.rule} className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] text-slate-300">{alert.title}</p>
          <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-600">
            {alert.endedAt
              ? `${formatUptime((alert.endedAt - alert.startedAt) / 1_000)} duration`
              : "resolved"}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[10px] text-slate-600">{alert.detail}</p>
      </div>
    </li>
  );
}

export function AlertBanner({
  alerts,
  onOpen,
}: {
  alerts: AlertState | null;
  onOpen: () => void;
}) {
  const active = alerts?.active ?? [];
  if (active.length === 0) return null;

  const critical = active.filter((alert) => alert.severity === "critical").length;
  const lead =
    (critical > 0 ? active.find((alert) => alert.severity === "critical") : undefined) ?? active[0];

  return (
    <div
      className={cn(
        "mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3.5 py-2.5",
        critical > 0
          ? "border-rose-400/25 bg-rose-400/[0.07]"
          : "border-amber-400/25 bg-amber-400/[0.07]",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
          critical > 0
            ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
            : "border-amber-400/25 bg-amber-400/10 text-amber-300",
        )}
      >
        <ShieldAlert className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-mono text-[9px] uppercase tracking-[0.14em]",
            critical > 0 ? "text-rose-300" : "text-amber-300",
          )}
        >
          {critical > 0 ? "Critical signal" : "Warning signal"} · {active.length} active
        </p>
        <p className="mt-0.5 truncate text-[11px] text-slate-400">
          {lead.title}
          <span className="text-slate-600"> — {lead.detail}</span>
          {active.length > 1 ? (
            <span className="text-slate-600"> · +{active.length - 1} more</span>
          ) : null}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="h-7 shrink-0 rounded-md border border-edge bg-ink-850 px-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-300 transition-colors hover:border-edge-bright hover:text-white"
      >
        Review
      </button>
    </div>
  );
}

export function AlertCenter({ open, alerts, onClose, onAcknowledge }: AlertCenterProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const active = alerts?.active ?? [];
  const recent = alerts?.recent ?? [];
  const critical = active.filter((alert) => alert.severity === "critical").length;
  const unacknowledged = active.filter((alert) => !alert.acknowledgedAt).length;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close alert center"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-center-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-[430px] flex-col border-l border-edge bg-ink-900 shadow-[-24px_0_80px_-32px_rgba(0,0,0,0.75)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-edge/80 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert
                className={cn(
                  "h-4 w-4",
                  critical > 0 ? "text-rose-300" : active.length > 0 ? "text-amber-300" : "text-emerald-300",
                )}
              />
              <h2 id="alert-center-title" className="text-[15px] font-semibold text-white">
                Alert center
              </h2>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Server-side rules evaluated every second · {unacknowledged} unacknowledged
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close alert center"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-edge bg-ink-850 text-slate-400 transition-colors hover:border-edge-bright hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="grid grid-cols-3 gap-2 border-b border-edge/80 px-5 py-3">
          <div className="rounded-lg border border-edge/70 bg-ink-850/60 px-2.5 py-2">
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">active</p>
            <p className="mt-1 text-[18px] font-semibold leading-none text-slate-200">{active.length}</p>
          </div>
          <div className="rounded-lg border border-edge/70 bg-ink-850/60 px-2.5 py-2">
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">critical</p>
            <p
              className={cn(
                "mt-1 text-[18px] font-semibold leading-none",
                critical > 0 ? "text-rose-300" : "text-slate-200",
              )}
            >
              {critical}
            </p>
          </div>
          <div className="rounded-lg border border-edge/70 bg-ink-850/60 px-2.5 py-2">
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">resolved</p>
            <p className="mt-1 text-[18px] font-semibold leading-none text-slate-200">{recent.length}</p>
          </div>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="flex items-center justify-between">
            <h3 className="panel-title">Active signals</h3>
            <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">
              live
            </span>
          </div>

          {active.length === 0 ? (
            <div className="mt-3 flex flex-col items-center justify-center rounded-xl border border-dashed border-edge/70 px-4 py-8 text-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10">
                <Check className="h-4 w-4 text-emerald-300" />
              </span>
              <p className="mt-2.5 text-[12px] font-medium text-slate-300">All clear</p>
              <p className="mt-1 max-w-[240px] text-[10px] leading-4 text-slate-600">
                No thresholds are currently breached. Try an error spike or traffic surge to
                exercise the rule engine.
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {active.map((alert) => (
                <ActiveAlert key={alert.id} alert={alert} onAcknowledge={onAcknowledge} />
              ))}
            </ul>
          )}

          <div className="mt-5 flex items-center justify-between">
            <h3 className="panel-title">Recent</h3>
            <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">
              this session
            </span>
          </div>
          {recent.length === 0 ? (
            <p className="mt-2 rounded-lg border border-edge/60 bg-ink-850/50 px-3 py-3 text-[10px] text-slate-600">
              Resolved alerts will appear here.
            </p>
          ) : (
            <ul className="mt-2">
              {recent.slice(0, 6).map((alert) => (
                <RecentAlert key={`${alert.id}-${alert.endedAt ?? 0}`} alert={alert} />
              ))}
            </ul>
          )}

          <div className="mt-5 rounded-xl border border-edge/70 bg-ink-850/50 p-3.5">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-cyan-300" />
              <h3 className="panel-title">Detection rules</h3>
            </div>
            <ul className="mt-2.5 space-y-1.5 font-mono text-[9px] leading-4 text-slate-600">
              <li>5xx rate · warning 5% · critical 12%</li>
              <li>p95 latency · warning 450ms · critical 900ms</li>
              <li>throughput · warning 1.5x target · critical 1.9x</li>
              <li>chart anomalies · robust z-score &gt; 3.5σ</li>
            </ul>
            <p className="mt-2 text-[10px] leading-4 text-slate-600">
              Warning rules require two consecutive samples. Alerts resolve after two clear
              samples, so brief spikes do not flap.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
