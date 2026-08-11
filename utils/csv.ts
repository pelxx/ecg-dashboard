export type RawEcgRecordData = Readonly<
  Record<
    string,
    {
      readonly lead1?: readonly number[];
      readonly lead2?: readonly number[];
      readonly lead3?: readonly number[];
      readonly interval?: number;
      readonly sampleIntervalMs?: number;
    }
  >
>;

export const convertEcgRecordToCsv = (data: RawEcgRecordData): string => {
  const rows = ["timestamp,lead1,lead2,lead3"];
  const sortedTimestamps = Object.keys(data).sort(
    (a, b) => Number(a) - Number(b)
  );

  for (const timestamp of sortedTimestamps) {
    const chunk = data[timestamp];
    const startMillis = Number(timestamp);
    const interval = chunk.sampleIntervalMs ?? chunk.interval ?? 4;
    const sampleCount = Math.max(
      chunk.lead1?.length ?? 0,
      chunk.lead2?.length ?? 0,
      chunk.lead3?.length ?? 0
    );

    for (let index = 0; index < sampleCount; index += 1) {
      rows.push(
        [
          startMillis + index * interval,
          chunk.lead1?.[index] ?? "",
          chunk.lead2?.[index] ?? "",
          chunk.lead3?.[index] ?? "",
        ].join(",")
      );
    }
  }

  return rows.join("\n");
};

export const triggerTextDownload = (
  content: string,
  fileName: string,
  mimeType: string
): void => {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = fileName;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
