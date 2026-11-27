import { formatVietnamTime } from "@/lib/vietnam-time";
import type { WhiteboardReadOnlyReason } from "../types";

export type WhiteboardTool =
  "freedraw" | "line" | "arrow" | "rectangle" | "ellipse" | "text" | "eraser";

export type WhiteboardElement = {
  id: string;
  type: string;
  version: number;
  versionNonce: number;
  isDeleted?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  points?: [number, number][];
  text?: string;
  fontSize?: number;
  [key: string]: unknown;
};

export type WhiteboardSceneData = {
  elements: WhiteboardElement[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
};

export const WHITEBOARD_DEFAULT_BG = "#ffffff";
export const WHITEBOARD_WIDTH = 1280;
export const WHITEBOARD_HEIGHT = 720;

export function randomNonce(): number {
  return Math.floor(Math.random() * 2_000_000_000);
}

export function isWhiteboardElement(
  value: unknown,
): value is WhiteboardElement {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length >= 1 &&
    v.id.length <= 128 &&
    typeof v.type === "string" &&
    v.type.length >= 1 &&
    v.type.length <= 64 &&
    typeof v.version === "number" &&
    Number.isInteger(v.version) &&
    v.version >= 0 &&
    typeof v.versionNonce === "number" &&
    Number.isInteger(v.versionNonce)
  );
}

export function parseWhiteboardScene(raw: unknown): WhiteboardSceneData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      elements: [],
      appState: { viewBackgroundColor: WHITEBOARD_DEFAULT_BG },
      files: {},
    };
  }
  const obj = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const elements: WhiteboardElement[] = [];
  if (Array.isArray(obj.elements)) {
    for (const item of obj.elements) {
      if (isWhiteboardElement(item) && !seen.has(item.id)) {
        seen.add(item.id);
        elements.push(item);
      }
    }
  }
  const appState: Record<string, unknown> =
    obj.appState &&
    typeof obj.appState === "object" &&
    !Array.isArray(obj.appState)
      ? { ...(obj.appState as Record<string, unknown>) }
      : { viewBackgroundColor: WHITEBOARD_DEFAULT_BG };
  delete appState.collaborators;
  const files =
    obj.files && typeof obj.files === "object" && !Array.isArray(obj.files)
      ? (obj.files as Record<string, unknown>)
      : {};
  return { elements, appState, files };
}

export function serializeWhiteboardScene(
  elements: readonly WhiteboardElement[],
  appState?: Record<string, unknown>,
  files?: Record<string, unknown>,
): WhiteboardSceneData {
  const cleanAppState: Record<string, unknown> = {
    viewBackgroundColor: WHITEBOARD_DEFAULT_BG,
    ...(appState ?? {}),
  };
  delete cleanAppState.collaborators;
  const deduped = new Map<string, WhiteboardElement>();
  for (const el of elements) {
    deduped.set(el.id, el);
  }
  return {
    elements: [...deduped.values()],
    appState: cleanAppState,
    files: files ?? {},
  };
}

/** Deterministic CRDT-style merge by (version, versionNonce). */
export function mergeWhiteboardElements(
  local: readonly WhiteboardElement[],
  remote: readonly WhiteboardElement[],
): WhiteboardElement[] {
  const map = new Map<string, WhiteboardElement>();
  const order: string[] = [];
  const put = (el: WhiteboardElement) => {
    const existing = map.get(el.id);
    if (!existing) {
      order.push(el.id);
      map.set(el.id, el);
      return;
    }
    if (
      el.version > existing.version ||
      (el.version === existing.version &&
        el.versionNonce > existing.versionNonce)
    ) {
      map.set(el.id, el);
    }
  };
  for (const el of local) put(el);
  for (const el of remote) put(el);
  return order.map((id) => map.get(id)!);
}

export function whiteboardReadOnlyMessage(
  reason: WhiteboardReadOnlyReason | null | undefined,
  editableFrom?: string | null,
  editableUntil?: string | null,
): string {
  switch (reason) {
    case "SESSION_UNDER_REPORT":
      return "Bảng trắng đã khóa chỉ đọc vì buổi học đang có báo cáo tranh chấp mở.";
    case "SESSION_NOT_EDITABLE":
      return "Trạng thái buổi học hiện không cho phép chỉnh sửa bảng trắng.";
    case "EDIT_WINDOW_NOT_OPEN":
      return editableFrom
        ? `Chưa đến khung giờ chỉnh sửa. Mở chỉnh sửa từ ${formatVietnamTime(editableFrom)}.`
        : "Chưa đến khung giờ cho phép chỉnh sửa bảng trắng.";
    case "EDIT_WINDOW_CLOSED":
      return editableUntil
        ? `Đã hết thời hạn chỉnh sửa (${formatVietnamTime(editableUntil)}). Bạn vẫn có thể xem lại.`
        : "Đã hết thời hạn chỉnh sửa bảng trắng. Bạn vẫn có thể xem lại.";
    case "WHITEBOARD_POLICY_NOT_READY":
      return "Cấu hình bảng trắng hiện chưa sẵn sàng trên máy chủ.";
    default:
      return "Bảng trắng đang ở chế độ chỉ đọc.";
  }
}

export function renderWhiteboardScene(
  ctx: CanvasRenderingContext2D,
  elements: readonly WhiteboardElement[],
  width: number,
  height: number,
  bgColor = WHITEBOARD_DEFAULT_BG,
) {
  ctx.save();
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // Subtle dot grid for readability
  ctx.fillStyle = "#e8e3dc";
  for (let gx = 32; gx < width; gx += 32) {
    for (let gy = 32; gy < height; gy += 32) {
      ctx.fillRect(gx, gy, 1.5, 1.5);
    }
  }

  for (const el of elements) {
    if (el.isDeleted) continue;
    const x = typeof el.x === "number" ? el.x : 0;
    const y = typeof el.y === "number" ? el.y : 0;
    const w = typeof el.width === "number" ? el.width : 0;
    const h = typeof el.height === "number" ? el.height : 0;
    const color =
      typeof el.strokeColor === "string" && el.strokeColor
        ? el.strokeColor
        : "#1e1e1e";
    const strokeWidth =
      typeof el.strokeWidth === "number" && el.strokeWidth > 0
        ? el.strokeWidth
        : 2;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (
      el.type === "freedraw" &&
      Array.isArray(el.points) &&
      el.points.length
    ) {
      ctx.beginPath();
      const first = el.points[0]!;
      ctx.moveTo(x + first[0], y + first[1]);
      for (let i = 1; i < el.points.length; i++) {
        const pt = el.points[i]!;
        ctx.lineTo(x + pt[0], y + pt[1]);
      }
      if (el.points.length === 1) {
        ctx.lineTo(x + first[0] + 0.5, y + first[1] + 0.5);
      }
      ctx.stroke();
    } else if (
      (el.type === "line" || el.type === "arrow") &&
      Array.isArray(el.points) &&
      el.points.length >= 2
    ) {
      const first = el.points[0]!;
      const last = el.points.at(-1)!;
      ctx.beginPath();
      ctx.moveTo(x + first[0], y + first[1]);
      for (let i = 1; i < el.points.length; i++) {
        const pt = el.points[i]!;
        ctx.lineTo(x + pt[0], y + pt[1]);
      }
      ctx.stroke();
      if (el.type === "arrow") {
        const prev = el.points.at(-2)!;
        const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
        const head = Math.max(10, strokeWidth * 4);
        const tx = x + last[0];
        const ty = y + last[1];
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(
          tx - head * Math.cos(angle - Math.PI / 6),
          ty - head * Math.sin(angle - Math.PI / 6),
        );
        ctx.moveTo(tx, ty);
        ctx.lineTo(
          tx - head * Math.cos(angle + Math.PI / 6),
          ty - head * Math.sin(angle + Math.PI / 6),
        );
        ctx.stroke();
      }
    } else if (el.type === "rectangle") {
      ctx.strokeRect(x, y, w, h);
    } else if (el.type === "diamond") {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      ctx.stroke();
    } else if (el.type === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(
        x + w / 2,
        y + h / 2,
        Math.abs(w / 2),
        Math.abs(h / 2),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    } else if (el.type === "text" && typeof el.text === "string") {
      const fontSize =
        typeof el.fontSize === "number" && el.fontSize > 0 ? el.fontSize : 20;
      ctx.font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textBaseline = "top";
      const lines = el.text.split("\n");
      lines.forEach((line, idx) => {
        ctx.fillText(line, x, y + idx * (fontSize * 1.3));
      });
    }
    ctx.restore();
  }
  ctx.restore();
}

export function hitTestWhiteboardElement(
  el: WhiteboardElement,
  px: number,
  py: number,
  tolerance = 12,
): boolean {
  if (el.isDeleted) return false;
  const x = typeof el.x === "number" ? el.x : 0;
  const y = typeof el.y === "number" ? el.y : 0;
  if (
    (el.type === "freedraw" || el.type === "line" || el.type === "arrow") &&
    Array.isArray(el.points)
  ) {
    return el.points.some(
      (pt) => Math.hypot(x + pt[0] - px, y + pt[1] - py) <= tolerance,
    );
  }
  if (el.type === "text") {
    const fontSize = typeof el.fontSize === "number" ? el.fontSize : 20;
    const text = typeof el.text === "string" ? el.text : "";
    const estW = Math.max(40, text.length * fontSize * 0.6);
    const estH = Math.max(
      fontSize * 1.4,
      text.split("\n").length * fontSize * 1.3,
    );
    return (
      px >= x - tolerance &&
      px <= x + estW + tolerance &&
      py >= y - tolerance &&
      py <= y + estH + tolerance
    );
  }
  const w = typeof el.width === "number" ? el.width : 0;
  const h = typeof el.height === "number" ? el.height : 0;
  const minX = Math.min(x, x + w) - tolerance;
  const maxX = Math.max(x, x + w) + tolerance;
  const minY = Math.min(y, y + h) - tolerance;
  const maxY = Math.max(y, y + h) + tolerance;
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}
