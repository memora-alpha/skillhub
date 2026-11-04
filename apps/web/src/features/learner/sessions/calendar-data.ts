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
