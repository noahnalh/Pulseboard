"use client";

import { useCallback, useMemo, useState } from "react";
import { Activity, Boxes, Globe2, PieChart, Timer } from "lucide-react";
import { detectSeriesAnomalies } from "@/lib/detection";
import { useEventStream } from "@/lib/use-event-stream";
import type { RegionStat, SeriesPoint, ServiceStat, StatusSlice } from "@/lib/types";
import { AlertBanner, AlertCenter } from "./alert-center";
import { ControlBar } from "./control-bar";
import { EventFeed } from "./event-feed";
import { Header } from "./header";
import { KpiStrip } from "./kpi-strip";
import { LatencyChart } from "./latency-chart";
import { Panel } from "./panel";
import { RegionsPanel } from "./regions-panel";
import { ServicesPanel } from "./services-panel";
import { StatusPanel } from "./status-panel";
import { ThroughputChart } from "./throughput-chart";

const EMPTY_SERIES: SeriesPoint[] = [];
const EMPTY_STATUS: StatusSlice[] = [];
const EMPTY_SERVICES: ServiceStat[] = [];
const EMPTY_REGIONS: RegionStat[] = [];

function AnomalyBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      title="Robust z-score above 3.5 against the trailing baseline"
      className="inline-flex items-center gap-1 rounded border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-amber-300"
    >
      <span className="h-1 w-1 rounded-full bg-amber-400" />
      {count} {count === 1 ? "anomaly" : "anomalies"}
    </span>
  );
}

export function Dashboard() {
  const { snapshot, events, status, paused, togglePause, setRate, trigger, acknowledgeAlert } =
    useEventStream();
  const metrics = snapshot?.metrics ?? null;
  const [range, setRange] = useState(60);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const series = snapshot?.series ?? EMPTY_SERIES;
  const chartSeries = useMemo(
    () => (series.length > range ? series.slice(-range) : series),
    [series, range],
  );
  const throughputAnomalies = useMemo(
    () => detectSeriesAnomalies(chartSeries, "throughput"),
    [chartSeries],
  );
  const latencyAnomalies = useMemo(
    () => detectSeriesAnomalies(chartSeries, "latency"),
    [chartSeries],
  );
  const activeAlerts = snapshot?.alerts?.active ?? [];
  const criticalAlerts = activeAlerts.filter((alert) => alert.severity === "critical").length;
  const rangeLabel = range >= 240 ? "4m" : range >= 120 ? "2m" : "60s";
  const closeAlerts = useCallback(() => setAlertsOpen(false), []);

  return (
    <div className="relative min-h-screen">
      <div className="grid-backdrop" aria-hidden="true" />

      <div className="relative z-10 mx-auto w-full max-w-[1560px] px-3 py-5 sm:px-5 sm:py-7 lg:px-8">
        <Header
          status={status}
          paused={paused}
          meta={snapshot?.meta ?? null}
          alertCount={activeAlerts.length}
          criticalAlerts={criticalAlerts}
          onOpenAlerts={() => setAlertsOpen(true)}
          onTogglePause={togglePause}
        />

        <ControlBar
          rate={snapshot?.meta.targetRate ?? null}
          range={range}
          onRateChange={setRate}
          onRangeChange={setRange}
          onTrigger={trigger}
        />

        <AlertBanner alerts={snapshot?.alerts ?? null} onOpen={() => setAlertsOpen(true)} />

        <KpiStrip
          metrics={metrics}
          sparkline={snapshot?.sparkline ?? []}
          meta={snapshot?.meta ?? null}
        />

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Panel
            title="Throughput"
            subtitle={`Inbound events per second · ${rangeLabel} window`}
            icon={<Activity className="h-3.5 w-3.5" />}
            className="lg:col-span-2"
            action={<AnomalyBadge count={throughputAnomalies.size} />}
          >
            <ThroughputChart data={chartSeries} anomalies={throughputAnomalies} />
          </Panel>

          <Panel
            title="Response mix"
            subtitle="Status classes · 60s window"
            icon={<PieChart className="h-3.5 w-3.5" />}
            action={
              <span className="rounded border border-edge bg-ink-850 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
                60s
              </span>
            }
          >
            <StatusPanel status={snapshot?.status ?? EMPTY_STATUS} metrics={metrics} />
          </Panel>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Panel
            title="Latency percentiles"
            subtitle={`Response time distribution · ${rangeLabel} window`}
            icon={<Timer className="h-3.5 w-3.5" />}
            className="lg:col-span-2"
            action={<AnomalyBadge count={latencyAnomalies.size} />}
          >
            <LatencyChart data={chartSeries} anomalies={latencyAnomalies} />
          </Panel>

          <Panel
            title="Edge regions"
            subtitle="Volume and 5xx rate by region"
            icon={<Globe2 className="h-3.5 w-3.5" />}
          >
            <RegionsPanel regions={snapshot?.regions ?? EMPTY_REGIONS} />
          </Panel>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <EventFeed
              events={events}
              status={status}
              paused={paused}
              onTogglePause={togglePause}
            />
          </div>

          <Panel
            title="Top services"
            subtitle="Ranked by volume · 60s window"
            icon={<Boxes className="h-3.5 w-3.5" />}
            action={
              metrics ? (
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
                  {metrics.activeServices} active
                </span>
              ) : null
            }
          >
            <ServicesPanel services={snapshot?.services ?? EMPTY_SERVICES} />
          </Panel>
        </div>

        <footer className="mt-4 flex flex-col gap-3 border-t border-edge/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[620px] text-[10px] leading-4 text-slate-600">
            Structured telemetry streamed over Server-Sent Events, aggregated in a rolling ring
            buffer. Set <span className="font-mono text-slate-500">KAFKA_BROKERS</span> to route the
            simulator through Kafka, or point an external producer at{" "}
            <span className="font-mono text-slate-500">POST /api/ingest</span>.
          </p>
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9px] text-slate-500">
            <span className="rounded border border-edge bg-ink-850 px-1.5 py-1">
              next.js 16
            </span>
            <span className="rounded border border-edge bg-ink-850 px-1.5 py-1">sse</span>
            <span className="rounded border border-edge bg-ink-850 px-1.5 py-1">recharts</span>
            <span className="rounded border border-edge bg-ink-850 px-1.5 py-1">tailwind 4</span>
            <span className="rounded border border-edge bg-ink-850 px-1.5 py-1">alert engine</span>
            <span className="rounded border border-cyan-400/15 bg-cyan-400/[0.06] px-1.5 py-1 text-cyan-500/80">
              kafka-ready
            </span>
          </div>
        </footer>
      </div>

      <AlertCenter
        open={alertsOpen}
        alerts={snapshot?.alerts ?? null}
        onClose={closeAlerts}
        onAcknowledge={acknowledgeAlert}
      />
    </div>
  );
}
