import type { ParsedECGPacket } from "@/types/ecg";

export type MQTTConnectionState =
  | { readonly status: "idle"; readonly connected: false; readonly error: null }
  | { readonly status: "connecting"; readonly connected: false; readonly error: null }
  | { readonly status: "connected"; readonly connected: true; readonly error: null }
  | { readonly status: "reconnecting"; readonly connected: false; readonly error: string | null }
  | { readonly status: "disconnected"; readonly connected: false; readonly error: string | null };

export interface MQTTDeviceStatus {
  readonly deviceId: string;
  readonly online?: boolean;
  readonly sampleRateHz?: number;
  readonly uptimeSeconds?: number;
  readonly signalQuality?: number;
  readonly streaming?: boolean;
  readonly lastSeen: number;
}

export type MQTTMessageEvent =
  | { readonly type: "ecg"; readonly packet: ParsedECGPacket }
  | { readonly type: "status"; readonly status: MQTTDeviceStatus }
  | { readonly type: "invalid"; readonly topic: string; readonly reason: string };

export interface MQTTServiceOptions {
  readonly brokerUrl: string;
  readonly topics: readonly string[];
  readonly onConnectionChange: (state: MQTTConnectionState) => void;
  readonly onMessage: (event: MQTTMessageEvent) => void;
}
