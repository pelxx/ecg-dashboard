export const formatNumber = (
  value?: number | null,
  options?: Intl.NumberFormatOptions
): string => {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("id-ID", options).format(value);
};

export const formatPercent = (value?: number | null): string => {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `${formatNumber(value, { maximumFractionDigits: 1 })}%`;
};
