type IdentifiedRow = { id?: string; userId?: string };
export function appendCursor(path: string, cursor?: string): string {
  if (!cursor) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}cursor=${encodeURIComponent(cursor)}`;
}
export function mergePage<T extends IdentifiedRow>(
  existing: readonly T[],
  incoming: readonly T[],
): T[] {
  const positions = new Map<string, number>();
  const result: T[] = [];
  for (const item of [...existing, ...incoming]) {
    const key = item.id ?? item.userId;
    const position = key === undefined ? undefined : positions.get(key);
    if (position !== undefined) result[position] = item;
    else {
      if (key !== undefined) positions.set(key, result.length);
      result.push(item);
    }
  }
  return result;
}
