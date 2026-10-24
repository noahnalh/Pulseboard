import type { TelemetryEvent } from "@/lib/types";

const SERVICES: Array<{ name: string; weight: number; baseLatency: number; routes: string[] }> = [
  { name: "api-gateway", weight: 26, baseLatency: 42, routes: ["/v1/proxy", "/v1/auth/verify", "/v1/health"] },
  { name: "payments", weight: 14, baseLatency: 138, routes: ["/v1/charge", "/v1/refund", "/v1/payouts"] },
  { name: "checkout", weight: 13, baseLatency: 96, routes: ["/v1/cart", "/v1/orders", "/v1/checkout"] },
  { name: "search", weight: 15, baseLatency: 58, routes: ["/v1/search", "/v1/suggest", "/v1/index"] },
  { name: "auth", weight: 11, baseLatency: 66, routes: ["/v1/session", "/v1/token", "/v1/mfa"] },
  { name: "inventory", weight: 8, baseLatency: 74, routes: ["/v1/stock", "/v1/reserve", "/v1/warehouses"] },
  { name: "notifications", weight: 7, baseLatency: 112, routes: ["/v1/email", "/v1/push", "/v1/webhooks"] },
  { name: "recommendations", weight: 6, baseLatency: 88, routes: ["/v1/feed", "/v1/similar", "/v1/trending"] },
];

const REGIONS: Array<{ name: string; weight: number }> = [
  { name: "us-east-1", weight: 32 },
  { name: "eu-west-1", weight: 24 },
  { name: "us-west-2", weight: 16 },
  { name: "ap-southeast-2", weight: 12 },
  { name: "ap-northeast-1", weight: 9 },
  { name: "sa-east-1", weight: 7 },
];

let sequence = 0;

function weightedPick<T extends { weight: number }>(items: T[]): T {
  let roll = Math.random() * items.reduce((sum, item) => sum + item.weight, 0);
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function randomId(prefix: string): string {
  sequence = (sequence + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${sequence.toString(36).padStart(4, "0")}${Math.floor(
    Math.random() * 1296,
  )
    .toString(36)
    .padStart(2, "0")}`;
}

export function randomIdForEvent(): string {
  return randomId("evt");
}

export interface GenerateOptions {
  errorBoost?: boolean;
  latencyBoost?: number;
  now?: number;
}

export function generateEvent(options: GenerateOptions = {}): TelemetryEvent {
  const service = weightedPick(SERVICES);
  const region = weightedPick(REGIONS);
  const now = options.now ?? Date.now();

  const roll = Math.random();
  let status: number;
  if (options.errorBoost && Math.random() < 0.24) {
    status = roll < 0.5 ? 503 : roll < 0.8 ? 500 : 502;
  } else if (roll < 0.026) {
    status = roll < 0.012 ? 500 : roll < 0.02 ? 503 : 502;
  } else if (roll < 0.062) {
    status = roll < 0.04 ? 404 : roll < 0.052 ? 429 : 401;
  } else if (roll < 0.082) {
    status = roll < 0.072 ? 304 : 302;
  } else {
    status = roll < 0.72 ? 200 : roll < 0.96 ? 201 : 204;
  }

  const isError = status >= 500;
  const spread = (Math.random() + Math.random() + Math.random() - 1.5) * 0.62;
  const latency =
    service.baseLatency *
    Math.exp(spread) *
    (options.latencyBoost ?? 1) *
    (isError ? 1.9 : 1) *
    (status === 304 ? 0.35 : 1);

  const route = service.routes[Math.floor(Math.random() * service.routes.length)];
  const bytes = Math.round(180 + Math.exp(Math.random() * 7.5) * (isError ? 2.4 : 1));

  return {
    id: randomIdForEvent(),
    ts: now,
    service: service.name,
    region: region.name,
    route,
    status,
    latencyMs: Math.min(12_000, Math.max(2, Math.round(latency))),
    bytes,
  };
}


