import { Kafka, logLevel } from "kafkajs";

const brokers = (process.env.KAFKA_BROKERS ?? "localhost:9092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);
const topic = process.env.KAFKA_TOPIC ?? "telemetry.events";
const rate = Math.max(1, Number(process.env.PRODUCER_RATE ?? 300));
const batchIntervalMs = 250;

const services = [
  { name: "api-gateway", baseLatency: 42, weight: 26 },
  { name: "payments", baseLatency: 138, weight: 14 },
  { name: "checkout", baseLatency: 96, weight: 13 },
  { name: "search", baseLatency: 58, weight: 15 },
  { name: "auth", baseLatency: 66, weight: 11 },
  { name: "inventory", baseLatency: 74, weight: 8 },
  { name: "notifications", baseLatency: 112, weight: 7 },
  { name: "recommendations", baseLatency: 88, weight: 6 },
];

const regions = [
  { name: "us-east-1", weight: 32 },
  { name: "eu-west-1", weight: 24 },
  { name: "us-west-2", weight: 16 },
  { name: "ap-southeast-2", weight: 12 },
  { name: "ap-northeast-1", weight: 9 },
  { name: "sa-east-1", weight: 7 },
];

const routes = {
  "api-gateway": ["/v1/proxy", "/v1/auth/verify", "/v1/health"],
  payments: ["/v1/charge", "/v1/refund", "/v1/payouts"],
  checkout: ["/v1/cart", "/v1/orders", "/v1/checkout"],
  search: ["/v1/search", "/v1/suggest", "/v1/index"],
  auth: ["/v1/session", "/v1/token", "/v1/mfa"],
  inventory: ["/v1/stock", "/v1/reserve", "/v1/warehouses"],
  notifications: ["/v1/email", "/v1/push", "/v1/webhooks"],
  recommendations: ["/v1/feed", "/v1/similar", "/v1/trending"],
};

let sequence = 0;

function weighted(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function makeEvent() {
  const service = weighted(services);
  const region = weighted(regions);
  const roll = Math.random();
  let status;
  if (roll < 0.026) status = roll < 0.012 ? 500 : roll < 0.02 ? 503 : 502;
  else if (roll < 0.062) status = roll < 0.04 ? 404 : roll < 0.052 ? 429 : 401;
  else if (roll < 0.082) status = roll < 0.072 ? 304 : 302;
  else status = roll < 0.72 ? 200 : roll < 0.96 ? 201 : 204;

  const spread = (Math.random() + Math.random() + Math.random() - 1.5) * 0.62;
  const latency = Math.round(
    service.baseLatency *
      Math.exp(spread) *
      (status >= 500 ? 1.9 : 1) *
      (status === 304 ? 0.35 : 1),
  );
  const serviceRoutes = routes[service.name];
  sequence = (sequence + 1) % 1_000_000;

  return {
    id: `kafka_${Date.now().toString(36)}${sequence.toString(36).padStart(4, "0")}`,
    ts: Date.now() - Math.floor(Math.random() * 120),
    service: service.name,
    region: region.name,
    route: serviceRoutes[Math.floor(Math.random() * serviceRoutes.length)],
    status,
    latencyMs: Math.max(2, Math.min(12_000, latency)),
    bytes: Math.round(180 + Math.exp(Math.random() * 7.5)),
  };
}

const kafka = new Kafka({
  clientId: "pulseboard-producer",
  brokers,
  logLevel: logLevel.NOTHING,
  retry: { retries: 10, initialRetryTime: 400 },
});
const producer = kafka.producer({ allowAutoTopicCreation: true });

let running = true;
let sent = 0;

async function main() {
  await producer.connect();
  console.log(`[producer] connected to ${brokers.join(",")}`);
  console.log(`[producer] publishing ~${rate} events/sec to "${topic}"`);

  const perTick = Math.max(1, Math.round((rate * batchIntervalMs) / 1000));
  const timer = setInterval(async () => {
    if (!running) return;
    const messages = Array.from({ length: perTick }, () => {
      const event = makeEvent();
      return { key: event.service, value: JSON.stringify(event), timestamp: String(event.ts) };
    });
    try {
      await producer.send({ topic, messages });
      sent += messages.length;
    } catch (error) {
      console.error(`[producer] send failed: ${String(error)}`);
    }
  }, batchIntervalMs);

  const shutdown = async () => {
    if (!running) return;
    running = false;
    clearInterval(timer);
    console.log(`[producer] sent ${sent} events, shutting down`);
    await producer.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(`[producer] fatal: ${String(error)}`);
  process.exit(1);
});
