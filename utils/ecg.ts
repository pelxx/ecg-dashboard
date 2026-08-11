import { ADC_CENTER, ADC_HALF_RANGE } from "@/constants/ecg";

export const toFiniteNumber = (value: unknown): number | null => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

export const normalizeEpochMillis = (value: unknown): number | null => {
  const numberValue = toFiniteNumber(value);
  if (numberValue === null) return null;

  return numberValue < 1e11 ? numberValue * 1000 : numberValue;
};

export const normalizeEcgValue = (value: number): number => {
  return Math.abs(value) <= 5 ? value : (value - ADC_CENTER) / ADC_HALF_RANGE;
};

export const getBpmTone = (bpm?: number | null): string => {
  if (!bpm || bpm < 50 || bpm > 120) return "text-red-300";
  if (bpm < 60 || bpm > 100) return "text-amber-300";
  return "text-emerald-300";
};
