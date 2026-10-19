export function parseLocalDateTime(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (
    year! < 1900 ||
    month! < 1 ||
    month! > 12 ||
    day! < 1 ||
    hour! > 23 ||
    minute! > 59
  )
    return;
  const date = new Date(year!, month! - 1, day!, hour!, minute!);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month! - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  )
    return;
  return date;
}
