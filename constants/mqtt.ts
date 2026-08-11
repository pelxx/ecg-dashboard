export const MQTT_BROKER_URL =
  process.env.NEXT_PUBLIC_MQTT_BROKER_URL ??
  "wss://broker.avisha.id:8084/mqtt";

export const MQTT_TOPICS = [
  "ECG_TA/ecg/+/realtime",
  "ECG_TA/devices/+/status",
] as const;