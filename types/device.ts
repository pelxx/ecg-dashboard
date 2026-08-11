import type { PatientProfile } from "@/types/patient";

export interface DeviceTelemetry {
  readonly online?: boolean;
  readonly mqttConnected?: boolean;
  readonly sampleRateHz?: number;
  readonly uptimeSeconds?: number;
  readonly streaming?: boolean;
  readonly lastSeen?: number;
}

export interface DeviceCard {
  readonly key: string;
  readonly deviceId: string;
  readonly assignment: PatientProfile;
  readonly nama: string;
  readonly umur: number;
  readonly jenis_kelamin: string;
  readonly status?: string;
  readonly lastSeen?: number;
  readonly isRecording?: boolean;
  readonly createdAt?: number;
  readonly updatedAt?: number;
  readonly telemetry: DeviceTelemetry;
}

export interface RawDevice {
  readonly assignment?: Partial<PatientProfile>;
  readonly patientName?: string;
  readonly patientId?: string;
  readonly age?: number | string;
  readonly gender?: string;
  readonly nama?: string;
  readonly umur?: number | string;
  readonly jenis_kelamin?: string;
  readonly status?: string;
  readonly lastSeen?: number;
  readonly isRecording?: boolean;
  readonly createdAt?: number;
  readonly updatedAt?: number;
  readonly doctor?: string;
  readonly admissionDate?: number;
  readonly telemetry?: Partial<DeviceTelemetry>;
  readonly sampleRateHz?: number;
  readonly uptimeSeconds?: number;
  readonly streaming?: boolean;
}
