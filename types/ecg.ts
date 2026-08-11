export type ECGLeadKey = "lead1" | "lead2" | "lead3";

export type ECGSensitivity = "auto" | "half" | "standard" | "double";

export type ECGLeadVisibility = Readonly<Record<ECGLeadKey, boolean>>;

export interface ECGDataPoint {
  readonly timestamp: number;
  readonly value: number;
}

export interface ECGLeadSamples {
  readonly lead1: readonly number[];
  readonly lead2: readonly number[];
  readonly lead3: readonly number[];
}

export interface ECGLeadSeries {
  readonly lead1: readonly ECGDataPoint[];
  readonly lead2: readonly ECGDataPoint[];
  readonly lead3: readonly ECGDataPoint[];
}

export interface ParsedECGPacket extends ECGLeadSamples {
  readonly deviceId: string;
  readonly startMillis: number;
  readonly sampleIntervalMs: number;
  readonly sampleRateHz: number;
  readonly bpm: number | null;
  readonly chunkSeq: number | null;
  readonly receivedAt: number;
}

export interface ECGChartSettings {
  readonly windowMs: number;
  readonly sensitivity: ECGSensitivity;
  readonly autoScale: boolean;
  readonly frozen: boolean;
  readonly showGrid: boolean;
  readonly visibleLeads: ECGLeadVisibility;
}
