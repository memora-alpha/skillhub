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
  const seen = new Set<string>();
  return [...existing, ...incoming].filter((item) => {
    const key = item.id ?? item.userId;
    if (key === undefined) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
