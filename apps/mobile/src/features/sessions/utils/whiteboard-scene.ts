import type { BoardElement, BoardScene } from "../api/classroom-contracts";

export const boardWidth = 1280;
export const boardHeight = 720;
export const emptyBoard = (): BoardScene => ({
  elements: [],
  appState: { viewBackgroundColor: "#ffffff" },
  files: {},
});
/** Same winner/order rule as the web board; retain deletion markers and opaque fields. */
export function mergeBoardElements(
  local: BoardElement[],
  remote: BoardElement[],
) {
  const rows = new Map<string, BoardElement>();
  for (const row of [...local, ...remote]) {
    const previous = rows.get(row.id);
    if (
      !previous ||
      row.version > previous.version ||
      (row.version === previous.version &&
        row.versionNonce > previous.versionNonce)
    )
      rows.set(row.id, row);
  }
  return [...rows.values()];
}
export function mergeBoardScenes(
  local: BoardScene,
  remote: BoardScene,
): BoardScene {
  return {
    ...remote,
    ...local,
    elements: mergeBoardElements(local.elements, remote.elements),
    appState: { ...remote.appState, ...local.appState },
    files: { ...remote.files, ...local.files },
  };
}
export function boardPoint(
  x: number,
  y: number,
  width: number,
): [number, number] {
  const scale = boardWidth / Math.max(1, width);
  return [
    Math.max(0, Math.min(boardWidth, x * scale)),
    Math.max(0, Math.min(boardHeight, y * scale)),
  ];
}
