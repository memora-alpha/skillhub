import { AppError } from "@/lib/http/errors";
import type { SessionsApi } from "../api/sessions-api";
import type {
  BoardElement,
  BoardScene,
  Whiteboard,
} from "../api/classroom-contracts";
import { classroomError } from "./classroom-presentation";
import {
  emptyBoard,
  mergeBoardElements,
  mergeBoardScenes,
} from "./whiteboard-scene";

export type BoardDocumentState = {
  scene: BoardScene;
  board: Whiteboard | null;
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  error: string;
  denied: boolean;
};
export function createWhiteboardDocument(options: {
  api: Pick<SessionsApi, "whiteboard" | "saveWhiteboard">;
  sessionId: string;
  isCurrent: () => boolean;
  draft?: BoardScene;
}) {
  let state: BoardDocumentState = {
    scene: options.draft ?? emptyBoard(),
    board: null,
    dirty: !!options.draft,
    loading: false,
    saving: false,
    error: "",
    denied: false,
  };
  let closed = false,
    edit = 0,
    epoch = 0;
  const listeners = new Set<() => void>();
  const active = () => !closed && options.isCurrent();
  function patch(next: Partial<BoardDocumentState>) {
    if (!active()) return;
    state = { ...state, ...next };
    listeners.forEach((fn) => fn());
  }
  function canEdit() {
    return (
      active() &&
      !!state.board &&
      !state.denied &&
      !state.board.readOnly &&
      (!state.board.editableUntil ||
        Date.parse(state.board.editableUntil) > Date.now())
    );
  }
  function snapshot(board: Whiteboard) {
    patch({
      board,
      denied: false,
      scene: state.dirty
        ? mergeBoardScenes(state.scene, board.sceneData ?? emptyBoard())
        : (board.sceneData ?? emptyBoard()),
    });
  }
  async function load(discardDraft = false) {
    if (!active() || state.loading || state.saving) return;
    const ticket = epoch;
    patch({ loading: true });
    try {
      const board = await options.api.whiteboard(options.sessionId);
      if (active() && ticket === epoch) {
        if (discardDraft) {
          edit++;
          patch({ dirty: false });
        }
        snapshot(board);
        patch({ error: "" });
      }
    } catch (cause) {
      if (ticket !== epoch) return;
      patch({
        error: classroomError(cause),
        denied:
          state.denied ||
          (cause instanceof AppError && [403, 404].includes(cause.status)),
      });
    } finally {
      if (ticket === epoch) patch({ loading: false });
    }
  }
  async function save() {
    if (!canEdit() || !state.dirty || state.loading || state.saving) return;
    const requestEpoch = epoch;
    patch({ saving: true, error: "" });
    try {
      let attempts = 0;
      while (active() && requestEpoch === epoch) {
        const ticket = edit;
        const revision = state.board!.revision;
        const scene = state.scene;
        try {
          const result = await options.api.saveWhiteboard(
            options.sessionId,
            revision,
            scene,
          );
          if (!active() || requestEpoch !== epoch) return;
          patch({
            board: { ...state.board!, ...result, sceneData: scene },
            dirty: edit !== ticket,
          });
          break;
        } catch (cause) {
          if (
            !(cause instanceof AppError) ||
            cause.code !== "WHITEBOARD_REVISION_CONFLICT" ||
            attempts++ > 0
          )
            throw cause;
          const latest = await options.api.whiteboard(options.sessionId);
          if (!active() || requestEpoch !== epoch) return;
          snapshot(latest);
          if (!canEdit())
            throw new AppError("http", 409, "WHITEBOARD_READ_ONLY");
        }
      }
    } catch (cause) {
      if (requestEpoch !== epoch) return;
      patch({ error: classroomError(cause) });
      if (cause instanceof AppError && cause.code === "WHITEBOARD_READ_ONLY") {
        try {
          const board = await options.api.whiteboard(options.sessionId);
          if (requestEpoch !== epoch) return;
          snapshot(board);
        } catch {
          /* Keep the draft; the failed write never grants editing. */
        }
        if (state.board) patch({ board: { ...state.board, readOnly: true } });
      }
      if (cause instanceof AppError && [403, 404].includes(cause.status))
        patch({ denied: true });
    } finally {
      if (requestEpoch === epoch) patch({ saving: false });
    }
  }
  function apply(elements: BoardElement[], remote = false) {
    if (!active() || !state.board || state.denied || (!remote && !canEdit()))
      return;
    const merged = mergeBoardElements(state.scene.elements, elements);
    if (
      merged.length === state.scene.elements.length &&
      merged.every((row, index) => row === state.scene.elements[index])
    )
      return;
    edit++;
    patch({ scene: { ...state.scene, elements: merged }, dirty: true });
  }
  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getSnapshot: () => state,
    canEdit,
    load,
    save,
    apply,
    activate() {
      closed = false;
    },
    close() {
      closed = true;
      epoch++;
      state = { ...state, loading: false, saving: false };
    },
  };
}
