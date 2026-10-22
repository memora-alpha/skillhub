export const pullThreshold = 64;
export function pullDistance(dx: number, dy: number, scrollY: number) {
  if (scrollY > 1 || dy <= 0 || Math.abs(dx) >= dy) return 0;
  return Math.min(dy, 120);
}
