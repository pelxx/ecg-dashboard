
import mqtt, { type MqttClient } from "mqtt";
import type {
  MQTTDeviceStatus,
  MQTTMessageEvent,
  MQTTServiceOptions,
} from "@/types/mqtt";
import type { ParsedECGPacket } from "@/types/ecg";
import {
  ECG_SAMPLE_INTERVAL_MS,
  ECG_SAMPLE_RATE_HZ,
} from "@/constants/ecg";
import { normalizeEpochMillis, toFiniteNumber } from "@/utils/ecg";

type MqttPayload = Readonly<Record<string, unknown>>;

const pickIntervalMs = (payload: MqttPayload): number => {
  const direct =
    toFiniteNumber(payload.sampleIntervalMs) ??
    toFiniteNumber(payload.intervalMs) ??
    toFiniteNumber(payload.interval);

  if (direct && direct > 0) return direct;

  const sampleRateHz = toFiniteNumber(payload.sampleRateHz);
  if (sampleRateHz && sampleRateHz > 0) return 1000 / sampleRateHz;

  return ECG_SAMPLE_INTERVAL_MS;
};

const pickLeadArray = (raw: unknown): readonly number[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((value) => toFiniteNumber(value))
    .filter((value): value is number => value !== null);
};

const readJsonPayload = (message: Buffer): MqttPayload | null => {
  try {
    const parsed = JSON.parse(message.toString()) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as MqttPayload)
      : null;
  } catch {
    return null;
  }
};

export const parseEcgPayload = (
  deviceId: string,
  payload: MqttPayload,
  receivedAt = Date.now()
): ParsedECGPacket | null => {
  const startMillis = normalizeEpochMillis(
    payload.startMillis ?? payload.timestamp
  );

  if (startMillis === null) return null;

  const sampleIntervalMs = pickIntervalMs(payload);
  const sampleRateHz =
    toFiniteNumber(payload.sampleRateHz) ?? 1000 / sampleIntervalMs;

  return {
    deviceId,
    startMillis,
    sampleIntervalMs,
    sampleRateHz,
    lead1: pickLeadArray(payload.lead1),
    lead2: pickLeadArray(payload.lead2),
    lead3: pickLeadArray(payload.lead3),
    bpm: toFiniteNumber(payload.bpm),
    chunkSeq: toFiniteNumber(payload.chunkSeq),
    receivedAt,
  };
};

export const parseDeviceStatusPayload = (
  deviceId: string,
  payload: MqttPayload,
  receivedAt = Date.now()
): MQTTDeviceStatus => ({
  deviceId,
  online: typeof payload.online === "boolean" ? payload.online : undefined,
  sampleRateHz: toFiniteNumber(payload.sampleRateHz) ?? undefined,
  uptimeSeconds: toFiniteNumber(payload.uptimeSeconds) ?? undefined,
  streaming: typeof payload.streaming === "boolean" ? payload.streaming : undefined,
  lastSeen: normalizeEpochMillis(payload.lastSeen) ?? receivedAt,
});

export class MQTTService {
  private client: MqttClient | null = null;
  private options: MQTTServiceOptions | null = null;

  connect(options: MQTTServiceOptions): void {
    this.cleanup();
    this.options = options;
    options.onConnectionChange({
      status: "connecting",
      connected: false,
      error: null,
    });
    console.log("Broker URL:", options.brokerUrl);
    const client = mqtt.connect(options.brokerUrl, {
      username:process.env.NEXT_PUBLIC_MQTT_USERNAME,
      password:process.env.NEXT_PUBLIC_MQTT_PASSWORD,
      reconnectPeriod: 2000,
      connectTimeout: 8000,
      clean: true,
    });

    this.client = client;

    client.on("connect", () => {
      options.onConnectionChange({
        status: "connected",
        connected: true,
        error: null,
      });
      this.subscribe(options.topics);
    });

    client.on("reconnect", () => {
      options.onConnectionChange({
        status: "reconnecting",
        connected: false,
        error: null,
      });
    });

    client.on("close", () => {
      options.onConnectionChange({
        status: "disconnected",
        connected: false,
        error: null,
      });
    });

    client.on("error", (error) => {
      options.onConnectionChange({
        status: "disconnected",
        connected: false,
        error: error.message,
      });
    });

    client.on("message", (topic, message) => {
      options.onMessage(this.parseMessage(topic, message));
    });
  }

  reconnect(): void {
    if (!this.options) return;
    const options = this.options;
    this.disconnect();
    this.connect(options);
  }

  disconnect(): void {
    this.client?.end(true);
    this.client = null;
  }

  subscribe(topics: readonly string[]): void {
  if (!this.client?.connected) return;

  for (const topic of topics) {
    console.log("Subscribe:", topic);

    this.client.subscribe(topic, (err) => {
      console.log(topic, err ?? "OK");
    });
  }
}

  unsubscribe(topics: readonly string[]): void {
    if (!this.client?.connected) return;
    for (const topic of topics) {
      this.client.unsubscribe(topic);
    }
  }

  publish(topic: string, payload: unknown): void {
    if (!this.client?.connected) return;
    this.client.publish(topic, JSON.stringify(payload));
  }

  cleanup(): void {
    this.disconnect();
    this.options = null;
  }

  private parseMessage(topic: string, message: Buffer): MQTTMessageEvent {
   const parts = topic.split("/");

if (parts.length !== 4) {
  return {
    type: "invalid",
    topic,
    reason: "Invalid MQTT topic",
  };
}

const payload = readJsonPayload(message);

if (!payload) {
  return {
    type: "invalid",
    topic,
    reason: "Invalid JSON payload",
  };
}

const [namespace, root, topicDeviceId, event] = parts;

if (namespace !== "ECG_TA") {
  return {
    type: "invalid",
    topic,
    reason: "Invalid namespace",
  };
}

const deviceId =
  typeof payload["deviceId"] === "string"
    ? payload["deviceId"]
    : topicDeviceId;

    if (root === "ecg" && event === "realtime") {
      const packet = parseEcgPayload(deviceId, payload);
      console.log({
      chunkSeq: packet?.chunkSeq,
      startMillis: packet?.startMillis,
      receivedAt: packet?.receivedAt,
      lead1: packet?.lead1.length,
      });
      if (!packet) {
        return { type: "invalid", topic, reason: "Invalid ECG payload" };
      }

      if (
        packet.lead1.length === 0 &&
        packet.lead2.length === 0 &&
        packet.lead3.length === 0
      ) {
        return { type: "invalid", topic, reason: "Empty ECG payload" };
      }

      return { type: "ecg", packet };
    }

    if (root === "devices" && event === "status") {
      return {
        type: "status",
        status: parseDeviceStatusPayload(deviceId, payload),
      };
    }

    return { type: "invalid", topic, reason: "Unsupported MQTT topic" };
  }
}

export const createDefaultECGPoint = (): { timestamp: number; value: number } => ({
  timestamp: 0,
  value: 0,
});

export const getDefaultSampleRate = (): number => ECG_SAMPLE_RATE_HZ;
