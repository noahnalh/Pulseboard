import type { SeriesPoint } from "./types";

export const ANOMALY_SIGMA = 3.5;

const BASELINE_POINTS = 45;
const MIN_POINTS = 8;

export type AnomalyMetric = "throughput" | "latency";

export interface SeriesAnomaly {
  t: number;
  value: number;
  score: number;
  direction: "spike" | "drop";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function anomalySettings(metric: AnomalyMetric): { minValue: number; minScale: number } {
  return metric === "throughput"
    ? { minValue: 12, minScale: 4 }
    : { minValue: 120, minScale: 25 };
}

export function detectSeriesAnomalies(
  points: SeriesPoint[],
  metric: AnomalyMetric,
): Map<number, SeriesAnomaly> {
  const anomalies = new Map<number, SeriesAnomaly>();
  if (points.length < MIN_POINTS + 1) return anomalies;

  const values = points.map((point) => (metric === "throughput" ? point.eps : point.p95));
  const { minValue, minScale } = anomalySettings(metric);

  for (let index = MIN_POINTS; index < values.length; index += 1) {
    const baseline = values.slice(Math.max(0, index - BASELINE_POINTS), index);
    const center = median(baseline);
    const deviations = baseline.map((value) => Math.abs(value - center));
    const scale = Math.max(median(deviations) * 1.4826, minScale);
    const value = values[index];
    const score = (value - center) / scale;

    if (value < minValue || Math.abs(score) < ANOMALY_SIGMA) continue;

    anomalies.set(points[index].t, {
      t: points[index].t,
      value,
      score,
      direction: score > 0 ? "spike" : "drop",
    });
  }

  return anomalies;
}
