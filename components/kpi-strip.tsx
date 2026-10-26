"use client";

import { Database, Gauge, Timer, TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  cn,
  formatCompact,
  formatInteger,
  formatLatency,
  formatPercent,
  formatUptime,
} from "@/lib/format";
import type { StreamMeta, StreamMetrics } from "@/lib/types";

interface KpiStripProps {
  metrics: StreamMetrics | null;
  sparkline: number[];
  meta: StreamMeta | null;
}

const ACCENTS = {
  emerald: {
    icon: "text-emerald-300",
    chip: "border-emerald-400/20 bg-emerald-400/10",
    line: "var(--chart-emerald)",
  },
  rose: {
    icon: "text-rose-300",
    chip: "border-rose-400/20 bg-rose-400/10",
    line: "var(--chart-rose)",
  },
  amber: {
    icon: "text-amber-300",
    chip: "border-amber-400/20 bg-amber-400/10",
    line: "var(--chart-amber)",
  },
  cyan: {
    icon: "text-cyan-300",
    chip: "border-cyan-400/20 bg-cyan-400/10",
    line: "var(--chart-cyan)",
  },
} as const;

type AccentKey = keyof typeof ACCENTS;

function AnimatedValue({
  value,
  format,
  className,
}: {
  value: number;
  format: (value: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previousRef = useRef(value);

  useEffect(() => {
    const start = previousRef.current;
    const end = value;
    previousRef.current = value;
    const element = ref.current;
    if (!element) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (start === end || reduced) {
      element.textContent = format(end);
      return;
    }

    let frame = 0;
    const started = performance.now();
    const duration = 320;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      element.textContent = format(start + (end - start) * eased);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [format, value]);

  return <span ref={ref} className={className} aria-label={format(value)} />;
}

function RadialGauge({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, value / Math.max(max, 0.0001)));
  const offset = circumference * (1 - progress);

  return (
    <div className="relative h-10 w-10" title={label} aria-label={label}>
      <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90" aria-hidden="true">
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="var(--chart-muted)"
          strokeWidth="2.5"
        />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)",
            filter: `drop-shadow(0 0 4px ${color}66)`,
          }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] tabular-nums text-slate-400">
        {Math.round(progress * 100)}%
      </span>
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const gradientId = `spark-${useId().replace(/:/g, "")}`;
  const series = values.length > 1 ? values : [0, 0];
  const width = 108;
  const height = 28;
  const max = Math.max(1, ...series);
  const step = width / (series.length - 1);
  const points = series.map((value, index) => {
    const x = index * step;
    const y = height - 2 - (value / max) * (height - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${points.join(" L")}`;
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface MetricCardProps {
  label: string;
  value: ReactNode;
  unit: string;
  icon: ReactNode;
  accent: AccentKey;
  footer: ReactNode;
  visual: ReactNode;
}

function MetricCard({ label, value, unit, icon, accent, footer, visual }: MetricCardProps) {
  const tone = ACCENTS[accent];
  return (
    <div className="panel group relative overflow-hidden px-4 pb-3.5 pt-4">
      <div className="flex items-start justify-between gap-3">
        <span className="panel-title">{label}</span>
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md border",
            tone.chip,
            tone.icon,
          )}
        >
          {icon}
        </span>
      </div>

      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="text-[30px] font-semibold leading-none tracking-tight text-white tabular-nums">
          {value}
        </span>
        <span className="text-[10px] text-slate-500">{unit}</span>
      </div>

      <div className="mt-3 flex h-7 items-end justify-between gap-3">
        <div className="min-w-0 flex-1 font-mono text-[10px] leading-4 text-slate-500">{footer}</div>
        <div className="shrink-0">{visual}</div>
      </div>
    </div>
  );
}

function Placeholder({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-white/[0.05]", className)} />;
}

export function KpiStrip({ metrics, sparkline, meta }: KpiStripProps) {
  const errorAccent: AccentKey =
    metrics && metrics.errorRate > 4 ? "rose" : metrics && metrics.errorRate > 1.5 ? "amber" : "emerald";
  const latencyAccent: AccentKey =
    metrics && metrics.p95 > 500 ? "rose" : metrics && metrics.p95 > 220 ? "amber" : "emerald";

  if (!metrics) {
    return (
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="panel px-4 pb-3.5 pt-4">
            <Placeholder className="h-2.5 w-20" />
            <Placeholder className="mt-4 h-8 w-28" />
            <Placeholder className="mt-4 h-3 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Throughput"
        value={<AnimatedValue value={metrics.eventsPerSec} format={formatInteger} />}
        unit="events/sec"
        icon={<Gauge className="h-3.5 w-3.5" />}
        accent="emerald"
        footer={
          <span>
            peak <span className="text-slate-300">{formatInteger(metrics.peakEps)}</span>/s ·{" "}
            {metrics.activeServices} services
          </span>
        }
        visual={<Sparkline values={sparkline} color="var(--chart-emerald)" />}
      />

      <MetricCard
        label="Error rate"
        value={
          <AnimatedValue
            value={metrics.errorRate}
            format={(value) => formatPercent(value, 1)}
          />
        }
        unit="5xx"
        icon={<TriangleAlert className="h-3.5 w-3.5" />}
        accent={errorAccent}
        footer={
          <span>
            <span className="text-slate-300">{formatInteger(metrics.errorCount)}</span> errors ·{" "}
            {formatInteger(metrics.windowEvents)} reqs
          </span>
        }
        visual={
          <RadialGauge
            value={metrics.errorRate}
            max={12}
            color={ACCENTS[errorAccent].line}
            label={`${formatPercent(metrics.errorRate)} error rate against the 12% critical threshold`}
          />
        }
      />

      <MetricCard
        label="p95 latency"
        value={<AnimatedValue value={metrics.p95} format={formatLatency} />}
        unit="p95"
        icon={<Timer className="h-3.5 w-3.5" />}
        accent={latencyAccent}
        footer={
          <span>
            p50 <span className="text-slate-300">{formatLatency(metrics.p50)}</span> · p99{" "}
            <span className="text-slate-300">{formatLatency(metrics.p99)}</span>
          </span>
        }
        visual={
          <RadialGauge
            value={metrics.p95}
            max={900}
            color={ACCENTS[latencyAccent].line}
            label={`${formatLatency(metrics.p95)} p95 latency against the 900ms critical threshold`}
          />
        }
      />

      <MetricCard
        label="Events captured"
        value={<AnimatedValue value={metrics.totalEvents} format={formatCompact} />}
        unit="total"
        icon={<Database className="h-3.5 w-3.5" />}
        accent="cyan"
        footer={
          <span>
            up <span className="text-slate-300">{formatUptime(meta?.uptimeSec ?? 0)}</span> ·{" "}
            {meta?.subscribers ?? 1} live
          </span>
        }
        visual={<Sparkline values={sparkline} color="var(--chart-cyan)" />}
      />
    </div>
  );
}
