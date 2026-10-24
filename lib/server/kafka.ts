import type { TelemetryEvent } from "@/lib/types";
import { normalizeEventList } from "./normalize";

export type KafkaStatus = "off" | "connecting" | "live" | "error";
export type KafkaMode = "off" | "produce" | "consume";

export interface KafkaOptions {
  brokers: string[];
  topic: string;
  mode: Exclude<KafkaMode, "off">;
  onEvent: (event: TelemetryEvent) => void;
  onFallback: (events: TelemetryEvent[]) => void;
  onStatus: (status: KafkaStatus) => void;
}

export interface KafkaHandle {
  publish: (events: TelemetryEvent[]) => void;
  close: () => Promise<void>;
}

function log(message: string): void {
  console.warn(`[pulseboard/kafka] ${message}`);
}

export async function startKafka(options: KafkaOptions): Promise<KafkaHandle> {
  const { brokers, topic, mode, onEvent, onFallback, onStatus } = options;
  let closed = false;
  let producerHealthy = false;
  let producer: import("kafkajs").Producer | null = null;
  let consumer: import("kafkajs").Consumer | null = null;

  onStatus("connecting");

  try {
    const { Kafka, logLevel } = await import("kafkajs");
    const kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID ?? "pulseboard-dashboard",
      brokers,
      logLevel: logLevel.NOTHING,
      retry: { retries: 8, initialRetryTime: 300, maxRetryTime: 8_000 },
      connectionTimeout: 5_000,
    });

    consumer = kafka.consumer({
      groupId: process.env.KAFKA_CONSUMER_GROUP ?? "pulseboard-dashboard",
      sessionTimeout: 20_000,
    });

    consumer.on(consumer.events.CRASH, (event) => {
      log(`consumer crashed: ${String(event.payload.error ?? "unknown")}`);
      onStatus("error");
    });
    consumer.on(consumer.events.DISCONNECT, () => {
      if (!closed) onStatus("error");
    });

    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    void consumer
      .run({
        eachBatchAutoResolve: true,
        eachMessage: async ({ message }) => {
          if (!message.value) return;
          try {
            const parsed: unknown = JSON.parse(message.value.toString());
            const { accepted } = normalizeEventList(parsed);
            for (const event of accepted) onEvent(event);
          } catch {
            log("dropped a malformed message");
          }
        },
      })
      .catch((error: unknown) => {
        log(`consumer stopped: ${String(error)}`);
        onStatus("error");
      });

    if (mode === "produce") {
      producer = kafka.producer({ allowAutoTopicCreation: true });
      producer.on(producer.events.DISCONNECT, () => {
        if (!closed) onStatus("error");
      });
      await producer.connect();
      producerHealthy = true;
    }

    onStatus("live");
    log(`connected to ${brokers.join(",")} (${mode} mode, topic "${topic}")`);
  } catch (error) {
    log(`connection failed: ${String(error)}`);
    onStatus("error");
  }

  return {
    publish(events) {
      if (!events.length) return;
      if (!producer || !producerHealthy || closed) {
        if (mode === "produce") onFallback(events);
        return;
      }
      producer
        .send({
          topic,
          messages: events.map((event) => ({
            key: event.service,
            value: JSON.stringify(event),
            timestamp: String(event.ts),
          })),
        })
        .catch((error: unknown) => {
          producerHealthy = false;
          onStatus("error");
          log(`produce failed, falling back to direct ingest: ${String(error)}`);
          onFallback(events);
        });
    },
    async close() {
      closed = true;
      await Promise.allSettled([producer?.disconnect(), consumer?.disconnect()]);
    },
  };
}
