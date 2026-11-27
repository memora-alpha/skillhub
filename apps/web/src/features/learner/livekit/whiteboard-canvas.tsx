"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  WHITEBOARD_DEFAULT_BG,
  WHITEBOARD_HEIGHT,
  WHITEBOARD_WIDTH,
  hitTestWhiteboardElement,
  randomNonce,
  renderWhiteboardScene,
  type WhiteboardElement,
  type WhiteboardTool,
} from "./whiteboard-scene";
import styles from "./room-whiteboard.module.css";

const colors = [
  "#1e1e1e",
  "#b91c1c",
  "#1d4ed8",
  "#15803d",
  "#b45309",
  "#7c3aed",
];
const widths = [2, 4, 7];

const toolLabels: { id: WhiteboardTool; label: string }[] = [
  { id: "freedraw", label: "Bút" },
  { id: "line", label: "Đường" },
  { id: "arrow", label: "Mũi tên" },
  { id: "rectangle", label: "Chữ nhật" },
  { id: "ellipse", label: "Elip" },
  { id: "text", label: "Chữ" },
  { id: "eraser", label: "Tẩy" },
];

export function WhiteboardCanvas({
  elements,
  bgColor = WHITEBOARD_DEFAULT_BG,
  readOnly,
  statusText,
  readOnlyNotice,
  onMutate,
  onSaveNow,
  saving,
  onClose,
}: Readonly<{
  elements: readonly WhiteboardElement[];
  bgColor?: string;
  readOnly: boolean;
  statusText?: string;
  readOnlyNotice?: string;
  onMutate?: (next: WhiteboardElement[], changed: WhiteboardElement[]) => void;
  onSaveNow?: () => void;
  saving?: boolean;
  onClose?: () => void;
}>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [tool, setTool] = useState<WhiteboardTool>("freedraw");
  const [color, setColor] = useState(colors[0]!);
  const [strokeWidth, setStrokeWidth] = useState(widths[0]!);
  const [draft, setDraft] = useState<WhiteboardElement | null>(null);
  const [textAt, setTextAt] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [undoIds, setUndoIds] = useState<string[]>([]);
  const [redoIds, setRedoIds] = useState<string[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const all = draft ? [...elements, draft] : elements;
    renderWhiteboardScene(
      ctx,
      all,
      WHITEBOARD_WIDTH,
      WHITEBOARD_HEIGHT,
      bgColor,
    );
  }, [elements, draft, bgColor]);

  useEffect(() => {
    if (textAt && !readOnly) {
      textInputRef.current?.focus();
    }
  }, [textAt, readOnly]);

  function toBoardPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x:
        ((event.clientX - rect.left) / Math.max(1, rect.width)) *
        WHITEBOARD_WIDTH,
      y:
        ((event.clientY - rect.top) / Math.max(1, rect.height)) *
        WHITEBOARD_HEIGHT,
    };
  }

  function eraseAt(px: number, py: number) {
    if (!onMutate) return;
    const target = [...elements]
      .reverse()
      .find((el) => hitTestWhiteboardElement(el, px, py));
    if (!target) return;
    const updated: WhiteboardElement = {
      ...target,
      isDeleted: true,
      version: target.version + 1,
      versionNonce: randomNonce(),
    };
    const next = elements.map((el) => (el.id === target.id ? updated : el));
    onMutate(next, [updated]);
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (readOnly || !onMutate) return;
    const pt = toBoardPoint(event);
    if (tool === "eraser") {
      event.currentTarget.setPointerCapture(event.pointerId);
      eraseAt(pt.x, pt.y);
      return;
    }
    if (tool === "text") {
      setTextAt(pt);
      setTextValue("");
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const id = crypto.randomUUID();
    if (tool === "freedraw" || tool === "line" || tool === "arrow") {
      setDraft({
        id,
        type: tool,
        version: 1,
        versionNonce: randomNonce(),
        isDeleted: false,
        x: pt.x,
        y: pt.y,
        strokeColor: color,
        strokeWidth,
        points: [[0, 0]],
      });
    } else {
      setDraft({
        id,
        type: tool,
        version: 1,
        versionNonce: randomNonce(),
        isDeleted: false,
        x: pt.x,
        y: pt.y,
        width: 0,
        height: 0,
        strokeColor: color,
        strokeWidth,
      });
    }
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (readOnly) return;
    if (tool === "eraser" && event.buttons === 1) {
      const pt = toBoardPoint(event);
      eraseAt(pt.x, pt.y);
      return;
    }
    if (!draft) return;
    const pt = toBoardPoint(event);
    const ox = typeof draft.x === "number" ? draft.x : 0;
    const oy = typeof draft.y === "number" ? draft.y : 0;
    if (draft.type === "freedraw") {
      const pts = Array.isArray(draft.points)
        ? draft.points
        : [[0, 0] as [number, number]];
      setDraft({
        ...draft,
        points: [...pts, [Math.round(pt.x - ox), Math.round(pt.y - oy)]],
      });
    } else if (draft.type === "line" || draft.type === "arrow") {
      setDraft({
        ...draft,
        points: [
          [0, 0],
          [Math.round(pt.x - ox), Math.round(pt.y - oy)],
        ],
      });
    } else {
      setDraft({
        ...draft,
        width: Math.round(pt.x - ox),
        height: Math.round(pt.y - oy),
      });
    }
  }

  function finishDraft() {
    if (!draft || !onMutate) {
      setDraft(null);
      return;
    }
    const committed = draft;
    setDraft(null);
    onMutate([...elements, committed], [committed]);
    setUndoIds((prev) => [...prev.slice(-49), committed.id]);
    setRedoIds([]);
  }

  function commitText() {
    if (!textAt || !onMutate) return;
    const trimmed = textValue.trim();
    setTextAt(null);
    setTextValue("");
    if (!trimmed) return;
    const el: WhiteboardElement = {
      id: crypto.randomUUID(),
      type: "text",
      version: 1,
      versionNonce: randomNonce(),
      isDeleted: false,
      x: Math.round(textAt.x),
      y: Math.round(textAt.y),
      text: trimmed,
      fontSize: 22,
      strokeColor: color,
    };
    onMutate([...elements, el], [el]);
    setUndoIds((prev) => [...prev.slice(-49), el.id]);
    setRedoIds([]);
  }

  function handleUndo() {
    if (readOnly || !onMutate || !undoIds.length) return;
    const targetId = undoIds.at(-1)!;
    const target = elements.find((el) => el.id === targetId && !el.isDeleted);
    setUndoIds((prev) => prev.slice(0, -1));
    if (!target) return;
    const updated: WhiteboardElement = {
      ...target,
      isDeleted: true,
      version: target.version + 1,
      versionNonce: randomNonce(),
    };
    onMutate(
      elements.map((el) => (el.id === target.id ? updated : el)),
      [updated],
    );
    setRedoIds((prev) => [...prev, target.id]);
  }

  function handleRedo() {
    if (readOnly || !onMutate || !redoIds.length) return;
    const targetId = redoIds.at(-1)!;
    const target = elements.find((el) => el.id === targetId && el.isDeleted);
    setRedoIds((prev) => prev.slice(0, -1));
    if (!target) return;
    const updated: WhiteboardElement = {
      ...target,
      isDeleted: false,
      version: target.version + 1,
      versionNonce: randomNonce(),
    };
    onMutate(
      elements.map((el) => (el.id === target.id ? updated : el)),
      [updated],
    );
    setUndoIds((prev) => [...prev, target.id]);
  }

  function handleClearAll() {
    if (readOnly || !onMutate) return;
    const changed: WhiteboardElement[] = [];
    const next = elements.map((el) => {
      if (el.isDeleted) return el;
      const updated: WhiteboardElement = {
        ...el,
        isDeleted: true,
        version: el.version + 1,
        versionNonce: randomNonce(),
      };
      changed.push(updated);
      return updated;
    });
    setConfirmClear(false);
    if (changed.length) onMutate(next, changed);
  }

  function exportPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "skillhub-whiteboard.png";
    document.body.append(a);
    a.click();
    a.remove();
  }

  const visibleCount = elements.filter((el) => !el.isDeleted).length;

  return (
    <div className={styles.board}>
      <div className={styles.toolbar}>
        {!readOnly ? (
          <div
            className={styles.toolGroup}
            role="toolbar"
            aria-label="Công cụ bảng trắng"
          >
            {toolLabels.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.toolBtn}
                data-active={tool === item.id}
                onClick={() => setTool(item.id)}
              >
                {item.label}
              </button>
            ))}
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                className={styles.swatch}
                style={{ backgroundColor: c }}
                data-active={color === c}
                aria-label={`Màu ${c}`}
                onClick={() => setColor(c)}
              />
            ))}
            {widths.map((w) => (
              <button
                key={w}
                type="button"
                className={styles.toolBtn}
                data-active={strokeWidth === w}
                onClick={() => setStrokeWidth(w)}
              >
                {w}px
              </button>
            ))}
          </div>
        ) : (
          <strong>Bảng trắng (chỉ đọc)</strong>
        )}

        <div className={styles.toolGroup}>
          {!readOnly && (
            <>
              <button
                type="button"
                className={styles.toolBtn}
                disabled={!undoIds.length}
                onClick={handleUndo}
              >
                Hoàn tác
              </button>
              <button
                type="button"
                className={styles.toolBtn}
                disabled={!redoIds.length}
                onClick={handleRedo}
              >
                Làm lại
              </button>
              {confirmClear ? (
                <>
                  <button
                    type="button"
                    className={styles.toolBtn}
                    data-active="true"
                    onClick={handleClearAll}
                  >
                    Xác nhận xóa hết
                  </button>
                  <button
                    type="button"
                    className={styles.toolBtn}
                    onClick={() => setConfirmClear(false)}
                  >
                    Hủy
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.toolBtn}
                  disabled={!visibleCount}
                  onClick={() => setConfirmClear(true)}
                >
                  Xóa bảng
                </button>
              )}
              {onSaveNow && (
                <button
                  type="button"
                  className={styles.toolBtn}
                  disabled={saving}
                  onClick={onSaveNow}
                >
                  {saving ? "Đang lưu…" : "Lưu ngay"}
                </button>
              )}
            </>
          )}
          <button type="button" className={styles.toolBtn} onClick={exportPng}>
            Tải PNG
          </button>
          {onClose && (
            <button type="button" className={styles.toolBtn} onClick={onClose}>
              Đóng bảng
            </button>
          )}
        </div>
      </div>

      {readOnlyNotice && <div className={styles.banner}>{readOnlyNotice}</div>}

      {textAt && !readOnly && (
        <div className={styles.textPrompt}>
          <input
            ref={textInputRef}
            type="text"
            value={textValue}
            placeholder="Nhập nội dung chữ lên bảng…"
            maxLength={300}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitText();
              } else if (e.key === "Escape") {
                setTextAt(null);
              }
            }}
          />
          <button
            type="button"
            className={styles.toolBtn}
            data-active="true"
            onClick={commitText}
          >
            Chèn chữ
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => setTextAt(null)}
          >
            Hủy
          </button>
        </div>
      )}

      <div className={styles.canvasFrame}>
        <canvas
          ref={canvasRef}
          width={WHITEBOARD_WIDTH}
          height={WHITEBOARD_HEIGHT}
          className={styles.canvas}
          data-readonly={readOnly}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishDraft}
          onPointerCancel={finishDraft}
        />
      </div>

      <div className={styles.statusBar}>
        <span>{visibleCount} nét / đối tượng trên bảng</span>
        {statusText && <span>{statusText}</span>}
      </div>
    </div>
  );
}
