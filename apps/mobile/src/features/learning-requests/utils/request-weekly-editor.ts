import {
  weeklyRows,
  weeklyRowsValue,
  type WeeklyRow,
} from "./request-weekly-slots";

type Entry = Readonly<{ key: string; row: WeeklyRow }>;

export function createWeeklyEditor() {
  let source: string | undefined;
  let sequence = 0;
  let entries: Entry[] = [];
  const entry = (row: WeeklyRow): Entry => ({
    key: `weekly-${sequence++}`,
    row,
  });
  function commit(next: Entry[]) {
    entries = next;
    source = weeklyRowsValue(next.map((item) => item.row));
    return source;
  }
  return {
    sync(value: string): readonly Entry[] {
      if (source !== value) {
        source = value;
        entries = (weeklyRows(value) ?? []).map(entry);
      }
      return entries;
    },
    update(key: string, row: WeeklyRow) {
      if (!entries.some((item) => item.key === key)) return undefined;
      return commit(
        entries.map((item) => (item.key === key ? { ...item, row } : item)),
      );
    },
    remove(key: string) {
      if (!entries.some((item) => item.key === key)) return undefined;
      return commit(entries.filter((item) => item.key !== key));
    },
    append() {
      if (entries.length >= 5) return undefined;
      return commit([
        ...entries,
        entry({ weekday: "", startTime: "", endTime: "" }),
      ]);
    },
  };
}
