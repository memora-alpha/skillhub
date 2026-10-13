// Decimal units match the 10 MB evidence upload limit.
export function formatFileSize(bytes: number): string {
  if (bytes < 1_000) return "Dưới 1 KB";
  const megabytes = bytes >= 1_000_000;
  const amount = bytes / (megabytes ? 1_000_000 : 1_000);
  return `${amount.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ${megabytes ? "MB" : "KB"}`;
}
