import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { randomUUID } from "expo-crypto";
import type { Room } from "livekit-client";
import { useSessionsRuntime } from "../runtime";
import { createWhiteboardDocument } from "../utils/whiteboard-document";
import { createWhiteboardTransport } from "../utils/room-whiteboard-transport";
import type { BoardElement } from "../api/classroom-contracts";
import { useClassroomActivity } from "./use-classroom-activity";

export function useSessionWhiteboard(options: {
  sessionId: string;
  enabled: boolean;
  room?: Room | null;
  peerIdentity?: string;
}) {
  const runtime = useSessionsRuntime();
  const active = useClassroomActivity(options.enabled && runtime.enabled);
  const document = useMemo(
    () =>
      createWhiteboardDocument({
        api: runtime.api,
        sessionId: options.sessionId,
        isCurrent: runtime.isCurrent,
        draft: runtime.whiteboardDrafts.get(options.sessionId),
      }),
    [
      runtime.api,
      runtime.isCurrent,
      runtime.whiteboardDrafts,
      options.sessionId,
    ],
  );
  const state = useSyncExternalStore(
    document.subscribe,
    document.getSnapshot,
    document.getSnapshot,
  );
  const transport = useRef<ReturnType<typeof createWhiteboardTransport> | null>(
    null,
  );
  const [room, peerIdentity] = [options.room, options.peerIdentity];
  useEffect(() => {
    document.activate();
    return () => {
      const current = document.getSnapshot();
      if (runtime.isCurrent() && current.dirty)
        runtime.whiteboardDrafts.set(options.sessionId, current.scene);
      else runtime.whiteboardDrafts.delete(options.sessionId);
      document.close();
    };
  }, [
    document,
    runtime.isCurrent,
    runtime.whiteboardDrafts,
    options.sessionId,
  ]);
  useEffect(() => {
    if (!active) return;
    void document.load();
    const timer = setInterval(() => {
      void document.load();
    }, 8000);
    return () => clearInterval(timer);
  }, [document, active]);
  useEffect(() => {
    if (!active || !room || !peerIdentity || !state.board || state.denied)
      return;
    const connection = createWhiteboardTransport({
      room,
      peerIdentity,
      isCurrent: runtime.isCurrent,
      createId: randomUUID,
      elements: () => document.getSnapshot().scene.elements,
      received: (rows) => document.apply(rows, true),
      toggled: () => {
        /* Opening a peer's board never forces a native modal. */
      },
    });
    transport.current = connection;
    connection.toggle(true);
    return () => {
      connection.close();
      transport.current = null;
    };
  }, [
    active,
    room,
    peerIdentity,
    !!state.board,
    state.denied,
    document,
    runtime.isCurrent,
  ]);
  useEffect(() => {
    if (!active || !state.dirty || state.saving || state.loading || state.error)
      return;
    const timer = setTimeout(() => {
      void document.save();
    }, 1200);
    return () => clearTimeout(timer);
  }, [
    active,
    state.scene,
    state.dirty,
    state.saving,
    state.loading,
    state.error,
    document,
  ]);
  return {
    ...state,
    canEdit: active && document.canEdit(),
    reload: document.load,
    save: document.save,
    hasUnsavedChanges: () => document.getSnapshot().dirty,
    useServerSnapshot: () => document.load(true),
    change(rows: BoardElement[]) {
      if (!active || !document.canEdit()) return;
      document.apply(rows);
      transport.current?.send(rows);
    },
  };
}
