import { vietnamDateKey } from "../../../lib/vietnam-time";

/** Index each session once rather than scanning every session for every day. */
export function groupSessionsByDay<T extends { startAt: string }>(
  sessions: readonly T[],
) {
  const days = new Map<string, T[]>();
  for (const session of sessions) {
    const key = vietnamDateKey(session.startAt);
    const group = days.get(key);
    if (group) group.push(session);
    else days.set(key, [session]);
  }
  return days;
}

export function partitionSessionsByDate<T extends { startAt: string }>(
  sessions: readonly T[],
  today: string,
) {
  const groups: { today: T[]; upcoming: T[]; past: T[] } = {
    today: [],
    upcoming: [],
    past: [],
  };
  for (const session of sessions) {
    const day = vietnamDateKey(session.startAt);
    if (day === today) groups.today.push(session);
    else if (day > today) groups.upcoming.push(session);
    else groups.past.push(session);
  }
  const byStart = (left: T, right: T) =>
    Date.parse(left.startAt) - Date.parse(right.startAt);
  groups.today.sort(byStart);
  groups.upcoming.sort(byStart);
  groups.past.sort((left, right) => -byStart(left, right));
  return groups;
}
