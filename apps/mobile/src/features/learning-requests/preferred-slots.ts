import { parseLocalDateTime } from "@/utils/local-date-time";
export type PreferredSlot = { startAt: string; endAt: string };
export function parsePreferredSlots(
  value: string,
  now = Date.now(),
): PreferredSlot[] | undefined {
  const rows = value.trim() ? value.trim().split(/\n+/) : [];
  if (rows.length > 5) return;
  const slots: PreferredSlot[] = [];
  for (const row of rows) {
    const [start, end, extra] = row.split("→").map((v) => v.trim());
    const from = parseLocalDateTime(start ?? "");
    const to = parseLocalDateTime(end ?? "");
    if (
      extra !== undefined ||
      !from ||
      !to ||
      from.getTime() <= now ||
      to <= from
    )
      return;
    slots.push({ startAt: from.toISOString(), endAt: to.toISOString() });
  }
  return slots;
}
export function formatPreferredSlots(slots: PreferredSlot[] = []): string {
  const local = (iso: string) => {
    const d = new Date(iso);
    const pad = (v: number) => String(v).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return slots.map((s) => `${local(s.startAt)} → ${local(s.endAt)}`).join("\n");
}
