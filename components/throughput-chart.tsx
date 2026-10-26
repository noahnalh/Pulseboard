"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import type { SeriesAnomaly } from "@/lib/detection";
import { formatAxisTime, formatCompact, formatFullTime, formatInteger } from "@/lib/format";
import type { SeriesPoint } from "@/lib/types";

interface ThroughputChartProps {
  data: SeriesPoint[];
  anomalies: Map<number, SeriesAnomaly>;
}

interface Layout {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  plotWidth: number;
  plotHeight: number;
  max: number;
}

function withAlpha(color: string, alpha: number): string {
  const value = color.trim();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    const expanded =
      hex.length === 3
        ? hex
            .split("")
            .map((part) => part + part)
            .join("")
        : hex;
    if (expanded.length >= 6) {
      const red = Number.parseInt(expanded.slice(0, 2), 16);
      const green = Number.parseInt(expanded.slice(2, 4), 16);
      const blue = Number.parseInt(expanded.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
  }
  if (value.startsWith("rgb(")) return value.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  return value;
}

function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 1) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function readColor(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  return styles.getPropertyValue(name).trim() || fallback;
}

function Legend({ anomalyCount }: { anomalyCount: number }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        successful
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        errors
      </span>
      {anomalyCount > 0 ? (
        <span className="inline-flex items-center gap-1.5 text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          {anomalyCount} anomalies
        </span>
      ) : null}
    </div>
  );
}

export const ThroughputChart = memo(function ThroughputChart({
  data,
  anomalies,
}: ThroughputChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipTimeRef = useRef<HTMLSpanElement>(null);
  const tooltipSuccessRef = useRef<HTMLSpanElement>(null);
  const tooltipErrorsRef = useRef<HTMLSpanElement>(null);
  const tooltipAnomalyRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef(data);
  const anomaliesRef = useRef(anomalies);
  const layoutRef = useRef<Layout | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const overlayFrameRef = useRef<number | null>(null);
  const visibleRef = useRef(true);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });

  const latest = data.length > 0 ? data[data.length - 1] : null;
  const ariaLabel = latest
    ? `Throughput chart. Latest ${formatInteger(latest.eps)} events per second, ${formatInteger(
        latest.errors,
      )} errors, ${anomalies.size} anomalies in the selected window.`
    : "Throughput chart waiting for telemetry.";

  const drawBase = useCallback(() => {
    const canvas = baseRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height, dpr } = sizeRef.current;
    if (width <= 0 || height <= 0) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const points = dataRef.current;
    if (points.length === 0) {
      layoutRef.current = null;
      return;
    }

    const styles = getComputedStyle(container);
    const colors = {
      grid: readColor(styles, "--chart-grid", "rgba(148,163,184,0.1)"),
      axis: readColor(styles, "--chart-axis", "#5b6b80"),
      emerald: readColor(styles, "--chart-emerald", "#34d399"),
      emeraldSoft: readColor(styles, "--chart-emerald-soft", "#6ee7b7"),
      rose: readColor(styles, "--chart-rose", "#fb7185"),
      roseSoft: readColor(styles, "--chart-rose-soft", "#fda4af"),
      amber: readColor(styles, "--chart-amber", "#fbbf24"),
    };

    const left = width < 480 ? 36 : 44;
    const right = 8;
    const top = 8;
    const bottom = 20;
    const plotWidth = Math.max(1, width - left - right);
    const plotHeight = Math.max(1, height - top - bottom);
    const peak = points.reduce((max, point) => Math.max(max, point.eps), 0);
    const max = niceMax(peak * 1.08);

    const layout: Layout = { width, height, left, right, top, bottom, plotWidth, plotHeight, max };
    layoutRef.current = layout;

    const xAt = (index: number) =>
      left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
    const yAt = (value: number) => top + plotHeight - (Math.max(0, value) / max) * plotHeight;

    context.font = '500 9px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';
    context.textBaseline = "middle";

    context.strokeStyle = colors.grid;
    context.lineWidth = 1;
    context.setLineDash([3, 5]);
    for (let tick = 0; tick <= 4; tick += 1) {
      const value = (max / 4) * tick;
      const y = Math.round(yAt(value)) + 0.5;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(left + plotWidth, y);
      context.stroke();

      context.setLineDash([]);
      context.fillStyle = colors.axis;
      context.textAlign = "right";
      context.fillText(formatCompact(value), left - 7, y);
      context.setLineDash([3, 5]);
    }
    context.setLineDash([]);

    const tickCount = width < 480 ? 4 : 6;
    context.fillStyle = colors.axis;
    context.textBaseline = "top";
    for (let tick = 0; tick < tickCount; tick += 1) {
      const index = Math.round(((points.length - 1) * tick) / (tickCount - 1));
      const x = xAt(index);
      context.textAlign = tick === 0 ? "left" : tick === tickCount - 1 ? "right" : "center";
      context.fillText(formatAxisTime(points[index].t), x, top + plotHeight + 7);
    }

    for (const anomaly of anomaliesRef.current.values()) {
      const index = points.findIndex((point) => point.t === anomaly.t);
      if (index === -1) continue;
      const x = xAt(index);
      const band = Math.max(7, plotWidth / Math.max(24, points.length) / 2);
      context.fillStyle = withAlpha(colors.amber, 0.075);
      context.fillRect(x - band, top, band * 2, plotHeight);
      context.strokeStyle = withAlpha(colors.amber, 0.3);
      context.lineWidth = 1;
      context.setLineDash([2, 4]);
      context.beginPath();
      context.moveTo(x + 0.5, top);
      context.lineTo(x + 0.5, top + plotHeight);
      context.stroke();
      context.setLineDash([]);
    }

    const success = points.map((point) => Math.max(0, point.eps - point.errors));
    const total = points.map((point) => point.eps);
    const bottomY = top + plotHeight;

    const successGradient = context.createLinearGradient(0, top, 0, bottomY);
    successGradient.addColorStop(0, withAlpha(colors.emerald, 0.34));
    successGradient.addColorStop(1, withAlpha(colors.emerald, 0.015));
    context.beginPath();
    context.moveTo(xAt(0), bottomY);
    points.forEach((_, index) => context.lineTo(xAt(index), yAt(success[index])));
    context.lineTo(xAt(points.length - 1), bottomY);
    context.closePath();
    context.fillStyle = successGradient;
    context.fill();

    const errorGradient = context.createLinearGradient(0, top, 0, bottomY);
    errorGradient.addColorStop(0, withAlpha(colors.rose, 0.55));
    errorGradient.addColorStop(1, withAlpha(colors.rose, 0.08));
    context.beginPath();
    points.forEach((_, index) => {
      const x = xAt(index);
      const y = yAt(total[index]);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    for (let index = points.length - 1; index >= 0; index -= 1) {
      context.lineTo(xAt(index), yAt(success[index]));
    }
    context.closePath();
    context.fillStyle = errorGradient;
    context.fill();

    context.lineJoin = "round";
    context.lineCap = "round";
    context.shadowBlur = 8;
    context.shadowColor = withAlpha(colors.emerald, 0.45);
    context.strokeStyle = colors.emeraldSoft;
    context.lineWidth = 1.4;
    context.beginPath();
    points.forEach((_, index) => {
      const x = xAt(index);
      const y = yAt(success[index]);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();

    context.shadowColor = withAlpha(colors.rose, 0.4);
    context.strokeStyle = colors.roseSoft;
    context.lineWidth = 1.15;
    context.beginPath();
    points.forEach((_, index) => {
      const x = xAt(index);
      const y = yAt(total[index]);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    context.shadowBlur = 0;

    for (const anomaly of anomaliesRef.current.values()) {
      const index = points.findIndex((point) => point.t === anomaly.t);
      if (index === -1) continue;
      const x = xAt(index);
      const y = yAt(total[index]);
      context.beginPath();
      context.arc(x, y, 2.6, 0, Math.PI * 2);
      context.fillStyle = colors.amber;
      context.fill();
      context.strokeStyle = withAlpha(colors.amber, 0.28);
      context.lineWidth = 4;
      context.stroke();
    }
  }, []);

  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    const tooltip = tooltipRef.current;
    if (!canvas || !tooltip) return;

    const { width, height, dpr } = sizeRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const layout = layoutRef.current;
    const points = dataRef.current;
    const index = hoverIndexRef.current;

    if (!layout || index === null || index < 0 || index >= points.length || !visibleRef.current) {
      tooltip.style.opacity = "0";
      tooltip.style.transform = "translate3d(-9999px, 0, 0)";
      return;
    }

    const styles = getComputedStyle(canvas);
    const emerald = readColor(styles, "--chart-emerald", "#34d399");
    const rose = readColor(styles, "--chart-rose", "#fb7185");
    const amber = readColor(styles, "--chart-amber", "#fbbf24");
    const axis = readColor(styles, "--chart-axis", "#5b6b80");

    const xAt = (pointIndex: number) =>
      layout.left +
      (points.length <= 1
        ? layout.plotWidth / 2
        : (pointIndex / (points.length - 1)) * layout.plotWidth);
    const yAt = (value: number) =>
      layout.top + layout.plotHeight - (Math.max(0, value) / layout.max) * layout.plotHeight;
    const point = points[index];
    const successValue = Math.max(0, point.eps - point.errors);
    const x = xAt(index);

    context.strokeStyle = axis;
    context.lineWidth = 1;
    context.setLineDash([3, 4]);
    context.beginPath();
    context.moveTo(x + 0.5, layout.top);
    context.lineTo(x + 0.5, layout.top + layout.plotHeight);
    context.stroke();
    context.setLineDash([]);

    const dot = (value: number, color: string) => {
      context.beginPath();
      context.arc(x, yAt(value), 3, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
      context.strokeStyle = withAlpha(color, 0.3);
      context.lineWidth = 5;
      context.stroke();
    };
    dot(successValue, emerald);
    dot(point.eps, rose);

    if (tooltipTimeRef.current) {
      tooltipTimeRef.current.textContent = `${formatFullTime(point.t)} UTC`;
    }
    if (tooltipSuccessRef.current) {
      tooltipSuccessRef.current.textContent = formatInteger(successValue);
    }
    if (tooltipErrorsRef.current) {
      tooltipErrorsRef.current.textContent = formatInteger(point.errors);
    }
    if (tooltipAnomalyRef.current) {
      const fraction = anomaliesRef.current.get(point.t);
      tooltipAnomalyRef.current.style.display = fraction ? "flex" : "none";
      if (fraction) {
        tooltipAnomalyRef.current.style.color = amber;
      }
    }

    const tooltipWidth = tooltip.offsetWidth || 168;
    const left = Math.min(
      layout.left + layout.plotWidth - tooltipWidth,
      Math.max(layout.left, x + 12),
    );
    tooltip.style.opacity = "1";
    tooltip.style.transform = `translate3d(${Math.round(left)}px, ${layout.top + 2}px, 0)`;
  }, []);

  const scheduleBase = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      if (visibleRef.current) drawBase();
    });
  }, [drawBase]);

  const scheduleOverlay = useCallback(() => {
    if (overlayFrameRef.current !== null) return;
    overlayFrameRef.current = window.requestAnimationFrame(() => {
      overlayFrameRef.current = null;
      drawOverlay();
    });
  }, [drawOverlay]);

  useEffect(() => {
    dataRef.current = data;
    anomaliesRef.current = anomalies;
    scheduleBase();
    scheduleOverlay();
  }, [data, anomalies, scheduleBase, scheduleOverlay]);

  useEffect(() => {
    const container = containerRef.current;
    const base = baseRef.current;
    const overlay = overlayRef.current;
    if (!container || !base || !overlay) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      sizeRef.current = { width, height, dpr };
      for (const canvas of [base, overlay]) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      drawBase();
      drawOverlay();
    };

    const resolveIndex = (event: PointerEvent): number | null => {
      const layout = layoutRef.current;
      if (!layout || dataRef.current.length === 0) return null;
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      if (x < layout.left - 8 || x > layout.left + layout.plotWidth + 8) return null;
      const ratio = Math.max(0, Math.min(1, (x - layout.left) / layout.plotWidth));
      return Math.round(ratio * (dataRef.current.length - 1));
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const index = resolveIndex(event);
      if (index === hoverIndexRef.current) return;
      hoverIndexRef.current = index;
      scheduleOverlay();
    };

    const onPointerLeave = () => {
      hoverIndexRef.current = null;
      scheduleOverlay();
    };

    const onVisibility = () => {
      visibleRef.current = !document.hidden;
      if (visibleRef.current) {
        drawBase();
        drawOverlay();
      }
    };

    const themeObserver = new MutationObserver(() => {
      scheduleBase();
      scheduleOverlay();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-accent", "style"],
    });

    const intersectionObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      visibleRef.current = entry.isIntersecting && !document.hidden;
      if (visibleRef.current) {
        drawBase();
        drawOverlay();
      }
    });
    intersectionObserver.observe(container);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    document.addEventListener("visibilitychange", onVisibility);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);
    resize();

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      if (overlayFrameRef.current !== null) window.cancelAnimationFrame(overlayFrameRef.current);
    };
  }, [drawBase, drawOverlay, scheduleBase, scheduleOverlay]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <Legend anomalyCount={anomalies.size} />
        <span className="font-mono text-[10px] text-slate-500">
          latest{" "}
          <span className="text-slate-300">{latest ? formatInteger(latest.eps) : "—"}</span> ev/s
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative h-[236px] w-full touch-pan-y select-none"
        role="img"
        aria-label={ariaLabel}
      >
        <canvas ref={baseRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        />
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-edge/70 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600">
            waiting for telemetry
          </div>
        ) : null}
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute left-0 top-0 z-10 min-w-[164px] rounded-lg border border-edge-bright bg-ink-900/95 px-3 py-2 opacity-0 shadow-[0_16px_40px_-16px_var(--tooltip-shadow)] backdrop-blur transition-opacity duration-100"
        >
          <span
            ref={tooltipTimeRef}
            className="block font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500"
          >
            —
          </span>
          <div className="mt-1.5 space-y-1 text-[11px]">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Successful
              </span>
              <span ref={tooltipSuccessRef} className="font-mono text-slate-200 tabular-nums">
                0
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                Errors
              </span>
              <span ref={tooltipErrorsRef} className="font-mono text-slate-200 tabular-nums">
                0
              </span>
            </div>
            <div
              ref={tooltipAnomalyRef}
              style={{ display: "none" }}
              className="items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em]"
            >
              <span className="h-1 w-1 rounded-full bg-amber-400" />
              anomaly flagged
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
