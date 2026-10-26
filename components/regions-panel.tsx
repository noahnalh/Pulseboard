"use client";

import { memo } from "react";
import { cn, formatInteger, formatPercent } from "@/lib/format";
import type { RegionStat } from "@/lib/types";

interface RegionsPanelProps {
  regions: RegionStat[];
}

const POSITIONS: Record<string, { x: number; y: number }> = {
  "us-east-1": { x: 58, y: 48 },
  "eu-west-1": { x: 174, y: 34 },
  "us-west-2": { x: 58, y: 132 },
  "ap-southeast-2": { x: 304, y: 132 },
  "ap-northeast-1": { x: 298, y: 58 },
  "sa-east-1": { x: 120, y: 178 },
};

const HUB = { x: 180, y: 100 };

function nodePosition(name: string, index: number): { x: number; y: number } {
  const known = POSITIONS[name];
  if (known) return known;
  const angle = (index / 6) * Math.PI * 2 - Math.PI / 2;
  return {
    x: HUB.x + Math.cos(angle) * 108,
    y: HUB.y + Math.sin(angle) * 72,
  };
}

function regionColor(errorRate: number): string {
  if (errorRate > 5) return "var(--chart-rose)";
  if (errorRate > 1) return "var(--chart-amber)";
  return "var(--accent)";
}

function labelAnchor(x: number): "start" | "middle" | "end" {
  if (x < 100) return "start";
  if (x > 260) return "end";
  return "middle";
}

export const RegionsPanel = memo(function RegionsPanel({ regions }: RegionsPanelProps) {
  const max = Math.max(1, ...regions.map((region) => region.count));
  const total = regions.reduce((sum, region) => sum + region.count, 0);
  const worst = regions.reduce<RegionStat | null>(
    (current, region) => (!current || region.errorRate > current.errorRate ? region : current),
    null,
  );

  if (regions.length === 0) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-lg border border-dashed border-edge/70 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600">
        awaiting region data
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative">
        <svg
          viewBox="0 0 360 208"
          className="h-[198px] w-full overflow-visible"
          role="img"
          aria-label={`Edge region network with ${regions.length} active regions`}
        >
          <defs>
            <radialGradient id="constellation-hub" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
              <stop offset="55%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {[48, 78, 108].map((radius) => (
            <ellipse
              key={radius}
              cx={HUB.x}
              cy={HUB.y}
              rx={radius * 1.35}
              ry={radius * 0.75}
              fill="none"
              stroke="var(--chart-grid)"
              strokeDasharray="2 6"
            />
          ))}

          {regions.map((region, index) => {
            const position = nodePosition(region.name, index);
            const middleX = (position.x + HUB.x) / 2;
            const width = 0.6 + (region.count / max) * 1.6;
            return (
              <path
                key={`link-${region.name}`}
                d={`M ${position.x} ${position.y} C ${middleX} ${position.y}, ${middleX} ${HUB.y}, ${HUB.x} ${HUB.y}`}
                fill="none"
                stroke={regionColor(region.errorRate)}
                strokeWidth={width}
                strokeOpacity={region.errorRate > 5 ? 0.48 : 0.2}
                strokeDasharray="2 8"
                className="constellation-flow"
              />
            );
          })}

          <circle cx={HUB.x} cy={HUB.y} r="34" fill="url(#constellation-hub)" opacity="0.5" />
          <circle
            cx={HUB.x}
            cy={HUB.y}
            r="9"
            fill="var(--color-ink-900)"
            stroke="var(--accent)"
            strokeWidth="1.5"
          />
          <circle cx={HUB.x} cy={HUB.y} r="3.5" fill="var(--accent)" className="live-dot" />
          <text
            x={HUB.x}
            y={HUB.y + 22}
            textAnchor="middle"
            className="fill-slate-600 font-mono text-[7px] uppercase tracking-[0.18em]"
          >
            edge core
          </text>

          {regions.map((region, index) => {
            const position = nodePosition(region.name, index);
            const radius = 3.5 + Math.sqrt(region.count / max) * 7;
            const color = regionColor(region.errorRate);
            const anchor = labelAnchor(position.x);
            const labelY = position.y < HUB.y ? position.y + radius + 12 : position.y + radius + 12;

            return (
              <g
                key={region.name}
                tabIndex={0}
                role="listitem"
                aria-label={`${region.name}: ${formatInteger(region.count)} requests, ${formatPercent(
                  region.errorRate,
                )} 5xx`}
                className="group/node cursor-help outline-none"
              >
                <title>
                  {region.name} · {formatInteger(region.count)} requests ·{" "}
                  {formatPercent(region.errorRate)} 5xx
                </title>
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={radius + 5}
                  fill={color}
                  opacity="0.08"
                  className="transition-opacity group-hover/node:opacity-20 group-focus/node:opacity-20"
                />
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={radius}
                  fill={color}
                  stroke="var(--color-ink-900)"
                  strokeWidth="1"
                  style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
                  className="transition-transform group-hover/node:scale-110 group-focus/node:scale-110"
                />
                <text
                  x={position.x}
                  y={labelY}
                  textAnchor={anchor}
                  className="fill-slate-400 font-mono text-[7px]"
                >
                  {region.name}
                </text>
                <text
                  x={position.x}
                  y={labelY + 9}
                  textAnchor={anchor}
                  className={cn(
                    "font-mono text-[7px] tabular-nums",
                    region.errorRate > 5
                      ? "fill-rose-300"
                      : region.errorRate > 1
                        ? "fill-amber-300"
                        : "fill-slate-600",
                  )}
                >
                  {formatInteger(region.count)} · {formatPercent(region.errorRate)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-auto grid grid-cols-3 gap-1.5 border-t border-edge/70 pt-2.5 text-center">
        <div>
          <p className="font-mono text-[7px] uppercase tracking-[0.14em] text-slate-600">regions</p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-300 tabular-nums">
            {regions.length}
          </p>
        </div>
        <div>
          <p className="font-mono text-[7px] uppercase tracking-[0.14em] text-slate-600">volume</p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-300 tabular-nums">
            {formatInteger(total)}
          </p>
        </div>
        <div>
          <p className="font-mono text-[7px] uppercase tracking-[0.14em] text-slate-600">
            worst 5xx
          </p>
          <p
            className={cn(
              "mt-0.5 font-mono text-[10px] tabular-nums",
              (worst?.errorRate ?? 0) > 5
                ? "text-rose-300"
                : (worst?.errorRate ?? 0) > 1
                  ? "text-amber-300"
                  : "text-slate-300",
            )}
          >
            {worst ? formatPercent(worst.errorRate) : "—"}
          </p>
        </div>
      </div>
    </div>
  );
});
