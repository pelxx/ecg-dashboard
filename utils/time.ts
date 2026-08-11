export const formatDateTime = (millis?: number | null): string => {
  if (!millis) return "--";

  return new Date(millis).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export const formatTime = (millis?: number | null): string => {
  if (!millis) return "--";
  return new Date(millis).toLocaleTimeString("id-ID");
};

export const formatDuration = (seconds?: number | null): string => {
  if (!seconds || seconds < 0) return "--";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};
