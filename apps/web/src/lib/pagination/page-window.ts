export function pageWindow(
  current: number,
  total: number | undefined,
  hasNext: boolean,
) {
  const last = Math.max(current, total ?? current + (hasNext ? 1 : 0));
  const start = Math.max(1, Math.min(current - 2, last - 4));
  return Array.from(
    { length: Math.min(5, last - start + 1) },
    (_, index) => start + index,
  );
}
