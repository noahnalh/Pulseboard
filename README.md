# Pulseboard

Pulseboard is a real-time event-driven telemetry dashboard for watching high-throughput
service traffic as it happens. It continuously ingests structured events, aggregates them
on the server, and pushes live snapshots to a responsive Next.js dashboard over
Server-Sent Events (SSE).

The project ships with a realistic traffic simulator, so it works immediately with a single
command. It can also consume real telemetry from Kafka or from any HTTP producer.

## Stack

- **Next.js 16** (App Router, Node runtime route handlers)
- **TypeScript**
- **Tailwind CSS 4**
- **Recharts** for live charts
- **KafkaJS** with an optional Apache Kafka broker (Docker Compose included)

## What it does

Pulseboard shows live event traffic across the following views:

- **Throughput** — successful and failed events per second
- **Latency percentiles** — p50, p95, and p99 response times
- **Response mix** — share of 2xx, 3xx, 4xx, and 5xx responses
- **Edge regions** — request volume and 5xx rate by region
- **Top services** — volume, p95 latency, and error counts per service
- **Event stream** — a rolling, newest-first feed with search, service/5xx filters, and CSV export
- **Alert center** — server-side threshold rules with severity, acknowledgment, and resolution history

KPIs and service/region aggregations use a 60-second window. The charts can switch between
60-second, 2-minute, and 4-minute windows, and they mark statistical anomalies using a robust
z-score against a trailing baseline.

The header shows connection state, ingest source, subscriber count, uptime, a UTC clock, an
active-alert badge, and a light/dark theme switcher (persisted in `localStorage`). A control
bar lets you change the simulated ingest rate, chart window, pause rendering, inject an error
spike, trigger a traffic surge, or reset the demo data.

### Alert engine

Snapshots carry alerts evaluated by the server every second. Rules promote after consecutive
samples and resolve after two clear samples to avoid flapping:

| Rule | Warning | Critical |
| --- | --- | --- |
| 5xx error rate | 5% | 12% |
| p95 latency | 450 ms | 900 ms |
| Throughput vs target | 1.5x | 1.9x |

Alerts can be acknowledged from the alert center. Acknowledgment does not resolve the alert;
it remains visible until the underlying metric recovers. Recent resolved alerts are retained
for the session.

### Real-time pipeline

```
Simulator ─┐
HTTP ingest ├─► normalize/validate ─► ring buffer + 1s buckets ─► SSE
Kafka ──────┘                              │
                                           ├─► snapshots every 1s
                                           └─► event batches every 300ms
```

Server-side aggregation keeps the browser workload flat even as event volume rises:

- Events are validated and normalized from several common field names.
- A 12,000-event ring buffer feeds the live table and per-service/region aggregations.
- Per-second buckets retain 240 seconds of counts and latency samples for percentile charts.
- Snapshots are serialized once per tick and broadcast to every connected client.
- The alert engine evaluates rolling 15-second metrics in the same snapshot tick, so short
  incidents are not hidden by the 60-second dashboard averages.
- The client parses frames with `EventSource`, batches React updates with
  `requestAnimationFrame`, deduplicates replayed events, and caps the event feed at 220 rows.
- Event filtering and CSV export run entirely in the browser over the capped feed.
- Rows and charts are memoized, and chart animations are disabled to avoid rendering spikes.

Kafka is optional and works in two modes:

- **produce** (default when `KAFKA_BROKERS` is set) — the built-in simulator publishes to
  Kafka, the app consumes from Kafka, and the dashboard renders the round trip.
- **consume** — the built-in simulator is disabled; the app only displays events produced by
  an external Kafka producer.

If Kafka is unreachable in produce mode, Pulseboard falls back to direct ingestion so the
dashboard keeps working.

## Quick start

Requirements: Node.js 20.9+ and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The simulator starts on first request
and pre-fills 45 seconds of history so the charts are populated immediately.

Production build:

```bash
npm run build
npm start
```

## Using Kafka

Start a single-node Kafka broker:

```bash
docker compose up -d
```

Create `.env.local`:

```env
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=telemetry.events
```

Restart the app. The simulator now produces events to Kafka and the dashboard consumes them.
The header badge shows the Kafka mode and connection status.

To use an external producer instead:

```env
KAFKA_BROKERS=localhost:9092
KAFKA_MODE=consume
```

Restart the app, then start the included producer:

```bash
PRODUCER_RATE=500 npm run kafka:producer
```

On Windows PowerShell:

```powershell
$env:PRODUCER_RATE=500; npm run kafka:producer
```

## Ingest API

Send real events into the dashboard with `POST /api/ingest`. A single event and `events`
arrays are both accepted. The minimum required fields are `status` and `latencyMs`.

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "service": "checkout",
    "region": "eu-west-1",
    "route": "/v1/orders",
    "status": 201,
    "latencyMs": 84,
    "bytes": 512
  }'
```

Inspect the endpoint contract:

```bash
curl http://localhost:3000/api/ingest
```

### Accepted field aliases

The normalizer accepts common log shapes:

| Canonical | Accepted aliases |
| --- | --- |
| `status` | `statusCode`, `code`, `http_status`, `responseStatus` |
| `latencyMs` | `latency`, `duration`, `durationMs`, `responseTime`, `elapsed` |
| `ts` | `timestamp`, `time`, `@timestamp`, `date` |
| `service` | `serviceName`, `app`, `source` |
| `region` | `zone`, `availabilityZone`, `location` |
| `route` | `path`, `pathname`, `url`, `endpoint` |
| `bytes` | `size`, `contentLength` |
| `id` | `eventId`, `requestId`, `traceId` |

Timestamps can be Unix seconds, Unix milliseconds, or ISO strings. Events older than five
minutes or further than 30 seconds in the future are clamped. Invalid status or latency
values are rejected.

NDJSON and newline-delimited JSON are supported with
`Content-Type: application/x-ndjson` (or `text/plain`). Requests are limited to 2 MB and
5,000 events. Set `INGEST_TOKEN` to require an `x-ingest-token` header.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/stream` | SSE stream of snapshots and event batches |
| `POST` | `/api/ingest` | Ingest one event, an array, or NDJSON |
| `GET` | `/api/ingest` | Describe the ingest contract |
| `GET` | `/api/snapshot` | Current aggregated snapshot |
| `POST` | `/api/control` | Set rate or trigger a scenario |
| `GET` | `/api/control` | Read the current rate and available actions |
| `GET` | `/api/alerts` | Read active and recently resolved alerts |
| `POST` | `/api/alerts` | Acknowledge an active alert by `id` |
| `GET` | `/api/health` | Runtime health, buffer size, subscriber count, Kafka state |

Control examples:

```bash
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{"rate": 600}'

curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{"action": "error-spike"}'
```

Actions: `error-spike`, `traffic-surge`, `reset`.

Acknowledge an alert using the `id` returned by `GET /api/alerts` (or from a snapshot):

```bash
curl -X POST http://localhost:3000/api/alerts \
  -H "Content-Type: application/json" \
  -d '{"id":"alert-error-rate-1760000000000"}'
```

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `SIMULATOR_RATE` | `120` | Initial simulator events per second (0–2,000) |
| `KAFKA_BROKERS` | unset | Comma-separated broker list; enables Kafka |
| `KAFKA_MODE` | `produce` | `produce` or `consume` when brokers are set |
| `KAFKA_TOPIC` | `telemetry.events` | Kafka topic |
| `KAFKA_CLIENT_ID` | `pulseboard-dashboard` | Kafka client ID |
| `KAFKA_CONSUMER_GROUP` | `pulseboard-dashboard` | Kafka consumer group |
| `INGEST_TOKEN` | unset | Optional token required by `/api/ingest` |
| `PRODUCER_RATE` | `300` | Events per second for `scripts/producer.mjs` |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm start` | Run the production server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run kafka:producer` | Publish synthetic events to Kafka |

## Project structure

```
app/
  api/
    alerts/         alert state + acknowledgment
    control/        rate + scenario controls
    health/         runtime health
    ingest/         HTTP/NDJSON ingestion
    snapshot/       current snapshot
    stream/         SSE endpoint
  globals.css       theme, panels, animations
  layout.tsx
  page.tsx
components/
  dashboard.tsx     layout composition
  kpi-strip.tsx
  throughput-chart.tsx
  latency-chart.tsx
  status-panel.tsx
  services-panel.tsx
  regions-panel.tsx
  event-feed.tsx    search, filters, CSV export
  alert-center.tsx  alert banner + center drawer
  control-bar.tsx   rate, chart window, scenarios
lib/
  server/
    alerts.ts       threshold rules + alert lifecycle
    generator.ts    realistic event simulator
    normalize.ts    loosely-shaped log normalization
    runtime.ts      buffers, aggregation, SSE fan-out
    kafka.ts        optional Kafka producer/consumer bridge
  detection.ts      robust z-score anomaly detection
  use-event-stream.ts
  format.ts
  types.ts
scripts/
  producer.mjs
docker-compose.yml  single-node Kafka (KRaft)
```

## Notes and limitations

- State is in memory. Restarting the server resets counters and history. For multi-instance
  deployments, Kafka should be the source of truth and snapshots should live in a shared
  store (for example Redis) with sticky SSE connections or a dedicated stream service.
- This is a demo dashboard, so the control endpoints are unauthenticated. Add your own
  authorization before exposing it publicly. Ingest can be protected with `INGEST_TOKEN`.
- SSE requires a long-lived Node server. Serverless platforms that do not support streaming
  or long requests will need a different transport.
