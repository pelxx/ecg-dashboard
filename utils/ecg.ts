export const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "boolean" || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

export const normalizeEpochMillis = (value: unknown): number | null => {
  const numberValue = toFiniteNumber(value);
  if (numberValue === null) return null;

  return numberValue < 1e11 ? numberValue * 1000 : numberValue;
};

export const normalizeEcgValue = (value: number): number => {
  return value;
};

export const getBpmTone = (bpm?: number | null): string => {
  if (!bpm || bpm < 50 || bpm > 120) return "text-red-300";
  if (bpm < 60 || bpm > 100) return "text-amber-300";
  return "text-emerald-300";
};
