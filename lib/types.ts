export type StatusClass = "2xx" | "3xx" | "4xx" | "5xx";

export interface TelemetryEvent {
  id: string;
  ts: number;
  service: string;
  region: string;
  route: string;
  status: number;
  latencyMs: number;
  bytes: number;
}

export interface SeriesPoint {
  t: number;
  eps: number;
  errors: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface StatusSlice {
  name: StatusClass;
  value: number;
}

export interface ServiceStat {
  name: string;
  count: number;
  errors: number;
  p95: number;
}

export interface RegionStat {
  name: string;
  count: number;
  errorRate: number;
}

export type AlertRule = "error-rate" | "latency-p95" | "throughput-surge";
export type AlertSeverity = "warning" | "critical";

export interface TelemetryAlert {
  id: string;
  rule: AlertRule;
  severity: AlertSeverity;
  title: string;
  detail: string;
  value: number;
  threshold: number;
  startedAt: number;
  updatedAt: number;
  acknowledgedAt: number | null;
  endedAt?: number;
}

export interface AlertState {
  active: TelemetryAlert[];
  recent: TelemetryAlert[];
}

export interface StreamMetrics {
  eventsPerSec: number;
  totalEvents: number;
  errorRate: number;
  successRate: number;
  p50: number;
  p95: number;
  p99: number;
  peakEps: number;
  activeServices: number;
  errorCount: number;
  windowEvents: number;
}

export interface StreamMeta {
  targetRate: number;
  subscribers: number;
  uptimeSec: number;
  kafkaMode: "off" | "produce" | "consume";
  kafkaStatus: "off" | "connecting" | "live" | "error";
  startedAt: number;
}

export interface StreamSnapshot {
  now: number;
  metrics: StreamMetrics;
  sparkline: number[];
  series: SeriesPoint[];
  status: StatusSlice[];
  services: ServiceStat[];
  regions: RegionStat[];
  alerts: AlertState;
  meta: StreamMeta;
}

export interface EventBatch {
  events: TelemetryEvent[];
}

export type ConnectionState = "connecting" | "live" | "reconnecting" | "paused";

export interface ControlPayload {
  rate?: number;
  action?: "error-spike" | "traffic-surge" | "reset";
}

export interface IngestPayload {
  events?: TelemetryEvent[];
  event?: TelemetryEvent;
}
