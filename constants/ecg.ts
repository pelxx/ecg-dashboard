import type { ECGLeadKey, ECGLeadVisibility, ECGSensitivity } from "@/types/ecg";

export const ECG_SAMPLE_RATE_HZ = 500;
export const ECG_SAMPLE_INTERVAL_MS = 1000 / ECG_SAMPLE_RATE_HZ;
export const DEFAULT_ECG_WINDOW_MS = 5000;
export const ADC_CENTER = 512;
export const ADC_HALF_RANGE = 700;

export const ECG_LEADS: readonly { key: ECGLeadKey; label: string }[] = [
  { key: "lead1", label: "Lead I" },
  { key: "lead2", label: "Lead II" },
  { key: "lead3", label: "Lead III" },
];

export const DEFAULT_LEAD_VISIBILITY: ECGLeadVisibility = {
  lead1: true,
  lead2: true,
  lead3: true,
};

export const ECG_SENSITIVITIES: readonly {
  label: string;
  value: ECGSensitivity;
}[] = [
  { label: "Auto", value: "auto" },
  { label: "5 mm/mV", value: "half" },
  { label: "10 mm/mV", value: "standard" },
  { label: "20 mm/mV", value: "double" },
];

export const ECG_PAPER_SPEEDS: readonly { label: string; value: number }[] = [
  { label: "25 mm/s", value: 10000 },
  { label: "50 mm/s", value: 5000 },
  { label: "100 mm/s", value: 2500 },
];
