function queueTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Oldest dated items first; unknown dates retain their order at the end. */
export function prepareOverviewQueue<T extends { at?: string | null }>(
  items: readonly T[],
) {
  return items
    .map((item) => ({ item, timestamp: queueTimestamp(item.at) }))
    .sort((left, right) => {
      if (left.timestamp === null) return right.timestamp === null ? 0 : 1;
      if (right.timestamp === null) return -1;
      return left.timestamp - right.timestamp;
    })
    .slice(0, 8)
    .map(({ item, timestamp }) => ({
      ...item,
      at: timestamp === null ? null : item.at,
    }));
}
