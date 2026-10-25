import type {
  RegionStat,
  SeriesPoint,
  ServiceStat,
  StatusClass,
  StatusSlice,
  StreamMeta,
  StreamMetrics,
  StreamSnapshot,
  TelemetryEvent,
} from "@/lib/types";
import { AlertManager } from "./alerts";
import { generateEvent } from "./generator";
import { startKafka, type KafkaHandle, type KafkaMode, type KafkaStatus } from "./kafka";

const RING_LIMIT = 12_000;
const WINDOW_SECONDS = 60;
const BUCKET_RETENTION_SECONDS = 240;
const SERIES_SECONDS = 240;
const FEED_BATCH_LIMIT = 60;
const MAX_LATENCIES_PER_BUCKET = 8_000;
const SNAPSHOT_INTERVAL_MS = 1_000;
const EVENT_FLUSH_INTERVAL_MS = 300;
const SIMULATOR_INTERVAL_MS = 100;

interface StoredEvent {
  seq: number;
  event: TelemetryEvent;
}

interface Bucket {
  t: number;
  count: number;
  errors: number;
  latencies: number[];
}

interface Subscriber {
  id: number;
  send: (event: string, payload: string) => void;
  lastSeq: number;
}

function clampRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(2_000, Math.max(0, Math.round(value)));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function statusClass(status: number): StatusClass {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  return "2xx";
}

class Runtime {
  private ring: StoredEvent[] = [];
  private buckets = new Map<number, Bucket>();
  private subscribers = new Set<Subscriber>();
  private seq = 0;
  private subscriberSeq = 0;
  private totalEvents = 0;
  private startedAt = Date.now();
  private alerts = new AlertManager();

  private targetRate: number;
  private simCarry = 0;
  private errorBoostUntil = 0;
  private surgeUntil = 0;
  private simTimer: NodeJS.Timeout | null = null;
  private snapshotTimer: NodeJS.Timeout | null = null;
  private flushTimer: NodeJS.Timeout | null = null;

  private kafkaMode: KafkaMode;
  private kafkaStatus: KafkaStatus = "off";
  private kafkaHandle: KafkaHandle | null = null;

  constructor() {
    const brokers = (process.env.KAFKA_BROKERS ?? "")
      .split(",")
      .map((broker) => broker.trim())
      .filter(Boolean);

    this.kafkaMode = brokers.length
      ? process.env.KAFKA_MODE === "consume"
        ? "consume"
        : "produce"
      : "off";

    const configuredRate = Number(process.env.SIMULATOR_RATE ?? 120);
    this.targetRate = clampRate(Number.isFinite(configuredRate) ? configuredRate : 120);

    if (this.kafkaMode !== "consume" && this.targetRate > 0) {
      this.prefill(45);
    }

    this.startTimers();

    if (this.kafkaMode !== "off") {
      void startKafka({
        brokers,
        topic: process.env.KAFKA_TOPIC ?? "telemetry.events",
        mode: this.kafkaMode,
        onEvent: (event) => this.ingest(event),
        onFallback: (events) => this.ingestMany(events),
        onStatus: (status) => {
          this.kafkaStatus = status;
        },
      }).then((handle) => {
        this.kafkaHandle = handle;
      });
    }
  }

  private startTimers(): void {
    if (this.kafkaMode !== "consume" && !this.simTimer) {
      this.simTimer = setInterval(() => this.simulate(), SIMULATOR_INTERVAL_MS);
      this.simTimer.unref?.();
    }
    this.snapshotTimer = setInterval(() => this.broadcastSnapshot(), SNAPSHOT_INTERVAL_MS);
    this.snapshotTimer.unref?.();
    this.flushTimer = setInterval(() => this.broadcastEvents(), EVENT_FLUSH_INTERVAL_MS);
    this.flushTimer.unref?.();
  }

  private simulate(): void {
    if (this.targetRate <= 0) return;
    const now = Date.now();
    const wave = 1 + Math.sin(now / 9_000) * 0.22 + Math.sin(now / 2_300) * 0.06;
    const surge = now < this.surgeUntil ? 2.2 : 1;
    const errorBoost = now < this.errorBoostUntil;

    this.simCarry += (this.targetRate * Math.max(0.12, wave) * surge) / (1_000 / SIMULATOR_INTERVAL_MS);
    let count = Math.floor(this.simCarry);
    this.simCarry -= count;
    count = Math.min(count, 500);

    if (count <= 0) return;
    const events: TelemetryEvent[] = new Array(count);
    for (let i = 0; i < count; i += 1) {
      events[i] = generateEvent({
        errorBoost,
        now: now - Math.floor(Math.random() * SIMULATOR_INTERVAL_MS),
      });
    }
    this.emit(events);
  }

  private emit(events: TelemetryEvent[]): void {
    if (this.kafkaMode === "produce") {
      if (this.kafkaHandle) this.kafkaHandle.publish(events);
      else this.ingestMany(events);
      return;
    }
    if (this.kafkaMode === "off") {
      this.ingestMany(events);
    }
  }

  ingest(event: TelemetryEvent): void {
    this.seq += 1;
    this.totalEvents += 1;
    this.ring.push({ seq: this.seq, event });

    if (this.ring.length >= RING_LIMIT) {
      this.ring.splice(0, Math.floor(RING_LIMIT * 0.2));
    }

    const second = Math.floor(event.ts / 1_000);
    let bucket = this.buckets.get(second);
    if (!bucket) {
      bucket = { t: second * 1_000, count: 0, errors: 0, latencies: [] };
      this.buckets.set(second, bucket);
    }
    bucket.count += 1;
    if (event.status >= 500) bucket.errors += 1;
    if (bucket.latencies.length < MAX_LATENCIES_PER_BUCKET) {
      bucket.latencies.push(event.latencyMs);
    }
  }

  ingestMany(events: TelemetryEvent[]): void {
    for (const event of events) this.ingest(event);
  }

  setRate(rate: number): number {
    this.targetRate = clampRate(rate);
    this.simCarry = 0;
    return this.targetRate;
  }

  acknowledgeAlert(id: string): boolean {
    const acknowledged = this.alerts.acknowledge(id);
    if (acknowledged) this.broadcastSnapshot();
    return acknowledged;
  }

  trigger(action: "error-spike" | "traffic-surge" | "reset"): void {
    const now = Date.now();
    if (action === "error-spike") {
      this.errorBoostUntil = now + 5_000;
      const burst: TelemetryEvent[] = [];
      for (let i = 0; i < 80; i += 1) {
        const event = generateEvent({ errorBoost: true, now: now - Math.floor(Math.random() * 900) });
        if (i % 5 !== 0) {
          event.status = i % 3 === 0 ? 500 : i % 3 === 1 ? 503 : 502;
          event.latencyMs = Math.round(event.latencyMs * 2.6);
        }
        burst.push(event);
      }
      this.emit(burst);
      return;
    }
    if (action === "traffic-surge") {
      this.surgeUntil = now + 8_000;
      return;
    }

    this.ring = [];
    this.buckets.clear();
    this.seq = 0;
    this.totalEvents = 0;
    this.startedAt = Date.now();
    this.errorBoostUntil = 0;
    this.surgeUntil = 0;
    this.alerts.reset();
    this.prefill(45);
    this.broadcastSnapshot();
  }

  private prefill(seconds: number): void {
    const baseRate = Math.max(80, Math.min(this.targetRate, 240));
    const now = Date.now();
    for (let offset = seconds; offset >= 1; offset -= 1) {
      const bucketStart = now - offset * 1_000;
      const wave = 1 + Math.sin(bucketStart / 9_000) * 0.18;
      const count = Math.max(1, Math.round(baseRate * wave * (0.9 + Math.random() * 0.2)));
      for (let i = 0; i < count; i += 1) {
        const event = generateEvent({
          now: bucketStart + Math.floor(Math.random() * 1_000),
        });
        this.ingest(event);
      }
    }
    this.prune(now);
  }

  private prune(now = Date.now()): void {
    const cutoff = Math.floor(now / 1_000) - BUCKET_RETENTION_SECONDS;
    for (const second of this.buckets.keys()) {
      if (second < cutoff) this.buckets.delete(second);
    }
  }

  private windowEvents(seconds = WINDOW_SECONDS): TelemetryEvent[] {
    const since = Date.now() - seconds * 1_000;
    const events: TelemetryEvent[] = [];
    for (const stored of this.ring) {
      if (stored.event.ts >= since) events.push(stored.event);
    }
    return events;
  }

  private buildSeries(nowSec: number): SeriesPoint[] {
    const points: SeriesPoint[] = [];
    for (let offset = SERIES_SECONDS; offset >= 1; offset -= 1) {
      const second = nowSec - offset;
      const bucket = this.buckets.get(second);
      if (!bucket) {
        points.push({
          t: second * 1_000,
          eps: 0,
          errors: 0,
          p50: 0,
          p95: 0,
          p99: 0,
        });
        continue;
      }
      const sorted = bucket.latencies.slice().sort((a, b) => a - b);
      points.push({
        t: bucket.t,
        eps: bucket.count,
        errors: bucket.errors,
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
      });
    }
    return points;
  }

  snapshot(): StreamSnapshot {
    const now = Date.now();
    const nowSec = Math.floor(now / 1_000);
    const window = this.windowEvents();
    const latencies = window.map((event) => event.latencyMs).sort((a, b) => a - b);
    const series = this.buildSeries(nowSec);

    const recentCompleted = series.slice(-5);
    const recentTotal = recentCompleted.reduce((sum, point) => sum + point.eps, 0);
    const eventsPerSec = Math.round(recentTotal / Math.max(1, recentCompleted.length));

    let errorCount = 0;
    const statusCounts: Record<StatusClass, number> = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
    const serviceMap = new Map<string, { count: number; errors: number; latencies: number[] }>();
    const regionMap = new Map<string, { count: number; errors: number }>();

    for (const event of window) {
      statusCounts[statusClass(event.status)] += 1;
      if (event.status >= 500) errorCount += 1;

      let service = serviceMap.get(event.service);
      if (!service) {
        service = { count: 0, errors: 0, latencies: [] };
        serviceMap.set(event.service, service);
      }
      service.count += 1;
      if (event.status >= 500) service.errors += 1;
      service.latencies.push(event.latencyMs);

      let region = regionMap.get(event.region);
      if (!region) {
        region = { count: 0, errors: 0 };
        regionMap.set(event.region, region);
      }
      region.count += 1;
      if (event.status >= 500) region.errors += 1;
    }

    const errorRate = window.length ? (errorCount / window.length) * 100 : 0;

    const services: ServiceStat[] = [...serviceMap.entries()]
      .map(([name, stat]) => {
        const sorted = stat.latencies.sort((a, b) => a - b);
        return {
          name,
          count: stat.count,
          errors: stat.errors,
          p95: percentile(sorted, 95),
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const regions: RegionStat[] = [...regionMap.entries()]
      .map(([name, stat]) => ({
        name,
        count: stat.count,
        errorRate: stat.count ? (stat.errors / stat.count) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const status: StatusSlice[] = (["2xx", "3xx", "4xx", "5xx"] as StatusClass[]).map((name) => ({
      name,
      value: statusCounts[name],
    }));

    const sparkline = series.slice(-40).map((point) => point.eps);

    let peakEps = 0;
    for (const bucket of this.buckets.values()) {
      if (bucket.count > peakEps) peakEps = bucket.count;
    }

    const meta: StreamMeta = {
      targetRate: this.targetRate,
      subscribers: this.subscribers.size,
      uptimeSec: Math.max(0, Math.round((now - this.startedAt) / 1_000)),
      kafkaMode: this.kafkaMode,
      kafkaStatus: this.kafkaStatus,
      startedAt: this.startedAt,
    };

    const metrics: StreamMetrics = {
      eventsPerSec,
      totalEvents: this.totalEvents,
      errorRate,
      successRate: 100 - errorRate,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      peakEps,
      activeServices: serviceMap.size,
      errorCount,
      windowEvents: window.length,
    };

    const alertWindow = this.windowEvents(15);
    let alertErrorCount = 0;
    const alertLatencies: number[] = [];
    for (const event of alertWindow) {
      if (event.status >= 500) alertErrorCount += 1;
      alertLatencies.push(event.latencyMs);
    }
    alertLatencies.sort((a, b) => a - b);
    const alertSeries = series.slice(-15);
    const alertEps = Math.round(
      alertSeries.reduce((sum, point) => sum + point.eps, 0) / Math.max(1, alertSeries.length),
    );

    this.alerts.evaluate({
      now,
      targetRate: this.targetRate,
      metrics: {
        errorRate: alertWindow.length ? (alertErrorCount / alertWindow.length) * 100 : 0,
        p95: percentile(alertLatencies, 95),
        eventsPerSec: alertEps,
      },
    });

    return {
      now,
      metrics,
      sparkline,
      series,
      status,
      services,
      regions,
      alerts: this.alerts.snapshot(),
      meta,
    };
  }

  subscribe(send: (event: string, payload: string) => void): () => void {
    this.subscriberSeq += 1;
    const subscriber: Subscriber = {
      id: this.subscriberSeq,
      send,
      lastSeq: Math.max(0, this.seq - 40),
    };
    this.subscribers.add(subscriber);

    send("snapshot", JSON.stringify(this.snapshot()));

    const recent = this.ring.slice(-40).map((stored) => stored.event);
    if (recent.length > 0) {
      subscriber.lastSeq = this.ring[this.ring.length - 1].seq;
      send("events", JSON.stringify({ events: recent }));
    }

    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  private broadcastSnapshot(): void {
    this.prune();
    if (this.subscribers.size === 0) return;
    const payload = JSON.stringify(this.snapshot());
    for (const subscriber of this.subscribers) {
      subscriber.send("snapshot", payload);
    }
  }

  private broadcastEvents(): void {
    if (this.subscribers.size === 0) return;
    for (const subscriber of this.subscribers) {
      if (subscriber.lastSeq >= this.seq) continue;

      const next: TelemetryEvent[] = [];
      for (let i = this.ring.length - 1; i >= 0 && next.length < FEED_BATCH_LIMIT; i -= 1) {
        if (this.ring[i].seq <= subscriber.lastSeq) break;
        next.push(this.ring[i].event);
      }
      if (next.length === 0) continue;

      next.reverse();
      subscriber.lastSeq = this.seq;
      subscriber.send("events", JSON.stringify({ events: next }));
    }
  }

  health(): Record<string, unknown> {
    const latest = this.ring[this.ring.length - 1];
    return {
      status: "ok",
      eventsInBuffer: this.ring.length,
      eventsTotal: this.totalEvents,
      subscribers: this.subscribers.size,
      buckets: this.buckets.size,
      targetRate: this.targetRate,
      activeAlerts: this.alerts.snapshot().active.length,
      latestEventAt: latest ? new Date(latest.event.ts).toISOString() : null,
      uptimeSec: Math.max(0, Math.round((Date.now() - this.startedAt) / 1_000)),
      kafka: { mode: this.kafkaMode, status: this.kafkaStatus },
    };
  }
}

const globalForRuntime = globalThis as typeof globalThis & {
  __pulseboardRuntime?: Runtime;
};

export function getRuntime(): Runtime {
  if (!globalForRuntime.__pulseboardRuntime) {
    globalForRuntime.__pulseboardRuntime = new Runtime();
  }
  return globalForRuntime.__pulseboardRuntime;
}
