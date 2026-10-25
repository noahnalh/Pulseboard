import type { AlertRule, AlertSeverity, AlertState, TelemetryAlert } from "@/lib/types";

const RECENT_LIMIT = 8;
const PROMOTE_AFTER = 2;
const RESOLVE_AFTER = 2;

interface AlertReading {
  rule: AlertRule;
  title: string;
  value: number;
  warning: number;
  critical: number;
  detail: string;
}

interface AlertContext {
  now: number;
  metrics: {
    errorRate: number;
    p95: number;
    eventsPerSec: number;
  };
  targetRate: number;
}

function severityFor(value: number, warning: number, critical: number): AlertSeverity | null {
  if (value >= critical) return "critical";
  if (value >= warning) return "warning";
  return null;
}

function readingsFor({ metrics, targetRate }: AlertContext): AlertReading[] {
  const readings: AlertReading[] = [
    {
      rule: "error-rate",
      title: "Elevated 5xx rate",
      value: metrics.errorRate,
      warning: 5,
      critical: 12,
      detail: `${metrics.errorRate.toFixed(1)}% of requests returned 5xx over the last 15s`,
    },
    {
      rule: "latency-p95",
      title: "p95 latency breach",
      value: metrics.p95,
      warning: 450,
      critical: 900,
      detail: `p95 latency reached ${Math.round(metrics.p95)} ms over the last 15s`,
    },
  ];

  if (targetRate >= 30) {
    readings.push({
      rule: "throughput-surge",
      title: "Throughput surge",
      value: metrics.eventsPerSec,
      warning: targetRate * 1.5,
      critical: targetRate * 1.9,
      detail: `${Math.round(metrics.eventsPerSec)} ev/s is ${(
        metrics.eventsPerSec / targetRate
      ).toFixed(1)}x the configured target`,
    });
  }

  return readings;
}

export class AlertManager {
  private active = new Map<AlertRule, TelemetryAlert>();
  private recent: TelemetryAlert[] = [];
  private hits = new Map<AlertRule, number>();
  private misses = new Map<AlertRule, number>();

  evaluate(context: AlertContext): void {
    for (const reading of readingsFor(context)) {
      const severity = severityFor(reading.value, reading.warning, reading.critical);
      const current = this.active.get(reading.rule);

      if (!current) {
        if (!severity) {
          this.hits.set(reading.rule, 0);
          continue;
        }

        const hits = (this.hits.get(reading.rule) ?? 0) + 1;
        this.hits.set(reading.rule, hits);
        if (severity !== "critical" && hits < PROMOTE_AFTER) continue;

        const threshold = severity === "critical" ? reading.critical : reading.warning;
        this.active.set(reading.rule, {
          id: `alert-${reading.rule}-${context.now}`,
          rule: reading.rule,
          severity,
          title: reading.title,
          detail: reading.detail,
          value: reading.value,
          threshold,
          startedAt: context.now,
          updatedAt: context.now,
          acknowledgedAt: null,
        });
        this.misses.set(reading.rule, 0);
        continue;
      }

      if (!severity) {
        const misses = (this.misses.get(reading.rule) ?? 0) + 1;
        this.misses.set(reading.rule, misses);
        if (misses < RESOLVE_AFTER) {
          current.value = reading.value;
          current.detail = reading.detail;
          current.updatedAt = context.now;
          continue;
        }

        const resolved: TelemetryAlert = {
          ...current,
          value: reading.value,
          detail: reading.detail,
          updatedAt: context.now,
          endedAt: context.now,
        };
        this.active.delete(reading.rule);
        this.recent = [resolved, ...this.recent].slice(0, RECENT_LIMIT);
        this.hits.set(reading.rule, 0);
        this.misses.set(reading.rule, 0);
        continue;
      }

      current.severity = severity;
      current.value = reading.value;
      current.detail = reading.detail;
      current.threshold = severity === "critical" ? reading.critical : reading.warning;
      current.updatedAt = context.now;
      this.misses.set(reading.rule, 0);
    }
  }

  acknowledge(id: string, now = Date.now()): boolean {
    for (const alert of this.active.values()) {
      if (alert.id !== id) continue;
      alert.acknowledgedAt = now;
      alert.updatedAt = now;
      return true;
    }
    return false;
  }

  snapshot(): AlertState {
    const active = [...this.active.values()].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
      return b.startedAt - a.startedAt;
    });
    return { active, recent: this.recent.slice(0, RECENT_LIMIT) };
  }

  reset(): void {
    this.active.clear();
    this.recent = [];
    this.hits.clear();
    this.misses.clear();
  }
}
