"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { useUserSession } from "../auth/session";
import { UserApiError } from "../api/client";
import type {
  SessionWhiteboard,
  SessionWhiteboardSave,
  WhiteboardReadOnlyReason,
} from "../types";
import {
  mergeWhiteboardElements,
  parseWhiteboardScene,
  serializeWhiteboardScene,
  whiteboardReadOnlyMessage,
  type WhiteboardElement,
} from "./whiteboard-scene";
import { createRoomWhiteboardTransport } from "./room-whiteboard-transport";

function formatSaveError(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : "Chưa lưu được bảng trắng. Thay đổi vẫn được giữ trên màn hình.";
}

export function useRoomWhiteboard(options: {
  sessionId: string;
  enabled: boolean;
  room?: Room | null;
  peerIdentity?: string;
  onRemoteToggle?: (open: boolean) => void;
}) {
  const { sessionId, enabled, room = null, peerIdentity = "" } = options;
  const { request } = useUserSession();

  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [revision, setRevision] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(true);
  const [readOnlyReason, setReadOnlyReason] =
    useState<WhiteboardReadOnlyReason | null>(null);
  const [editableFrom, setEditableFrom] = useState<string | null>(null);
  const [editableUntil, setEditableUntil] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string>();

  const elementsRef = useRef<WhiteboardElement[]>([]);
  const revisionRef = useRef(0);
  const appStateRef = useRef<Record<string, unknown>>({});
  const filesRef = useRef<Record<string, unknown>>({});
  const readOnlyRef = useRef(true);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const transportRef = useRef<ReturnType<
    typeof createRoomWhiteboardTransport
  > | null>(null);
  const remoteToggleRef = useRef(options.onRemoteToggle);

  useEffect(() => {
    remoteToggleRef.current = options.onRemoteToggle;
  }, [options.onRemoteToggle]);

  const applyServerSnapshot = useCallback(
    (data: SessionWhiteboard, mergeWithLocal = false) => {
      const parsed = parseWhiteboardScene(data.sceneData);
      appStateRef.current = parsed.appState ?? {};
      filesRef.current = parsed.files ?? {};
      const nextElements = mergeWithLocal
        ? mergeWhiteboardElements(elementsRef.current, parsed.elements)
        : parsed.elements;
      elementsRef.current = nextElements;
      revisionRef.current = data.revision;
      readOnlyRef.current = data.readOnly;
      setElements(nextElements);
      setRevision(data.revision);
      setUpdatedAt(data.updatedAt);
      setReadOnly(data.readOnly);
      setReadOnlyReason(data.readOnlyReason);
      setEditableFrom(data.editableFrom);
      setEditableUntil(data.editableUntil);
      setRetentionDays(data.retentionDays ?? null);
      return nextElements;
    },
    [],
  );

  const load = useCallback(
    async (mergeWithLocal = false) => {
      setLoading(true);
      setError(undefined);
      try {
        const res = await request<SessionWhiteboard>(
          `sessions/${sessionId}/whiteboard`,
        );
        applyServerSnapshot(res.data, mergeWithLocal);
        if (!mergeWithLocal) {
          dirtyRef.current = false;
          setDirty(false);
        }
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Chưa tải được bảng trắng của buổi học.",
        );
      } finally {
        setLoading(false);
      }
    },
    [applyServerSnapshot, request, sessionId],
  );

  useEffect(() => {
    if (!enabled) return;
    const kickoff = setTimeout(() => void load(false), 0);
    return () => clearTimeout(kickoff);
  }, [enabled, load]);

  const applySavedRevision = useCallback((saved: SessionWhiteboardSave) => {
    revisionRef.current = saved.revision;
    setRevision(saved.revision);
    setUpdatedAt(saved.updatedAt);
    dirtyRef.current = false;
    setDirty(false);
  }, []);

  const persistSnapshot = useCallback(
    (expectedRevision: number, els: readonly WhiteboardElement[]) =>
      request<SessionWhiteboardSave>(`sessions/${sessionId}/whiteboard`, {
        method: "PUT",
        body: {
          expectedRevision,
          sceneData: serializeWhiteboardScene(
            els,
            appStateRef.current,
            filesRef.current,
          ),
        },
      }),
    [request, sessionId],
  );

  const resolveRevisionConflict = useCallback(async () => {
    const latest = await request<SessionWhiteboard>(
      `sessions/${sessionId}/whiteboard`,
    );
    const merged = applyServerSnapshot(latest.data, true);
    if (latest.data.readOnly) return;
    const retried = await persistSnapshot(latest.data.revision, merged);
    applySavedRevision(retried.data);
  }, [
    applySavedRevision,
    applyServerSnapshot,
    persistSnapshot,
    request,
    sessionId,
  ]);

  const applyReadOnlyRejection = useCallback((cause: UserApiError) => {
    let reason: WhiteboardReadOnlyReason | null = null;
    if (
      cause.details &&
      typeof cause.details === "object" &&
      "reason" in cause.details &&
      typeof (cause.details as { reason?: unknown }).reason === "string"
    ) {
      reason = (cause.details as { reason: WhiteboardReadOnlyReason }).reason;
    }
    readOnlyRef.current = true;
    dirtyRef.current = false;
    setReadOnly(true);
    setReadOnlyReason(reason);
    setDirty(false);
    setError(cause.message);
  }, []);

  const handleSaveFailure = useCallback(
    async (cause: unknown) => {
      if (cause instanceof UserApiError) {
        if (cause.code === "WHITEBOARD_REVISION_CONFLICT") {
          try {
            await resolveRevisionConflict();
          } catch (retryError) {
            setError(formatSaveError(retryError));
          }
          return;
        }
        if (cause.code === "WHITEBOARD_READ_ONLY") {
          applyReadOnlyRejection(cause);
          return;
        }
      }
      setError(formatSaveError(cause));
    },
    [applyReadOnlyRejection, resolveRevisionConflict],
  );

  const saveNow = useCallback(async () => {
    if (readOnlyRef.current || savingRef.current || !dirtyRef.current) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
    }
    savingRef.current = true;
    setSaving(true);
    setError(undefined);
    try {
      const saved = await persistSnapshot(
        revisionRef.current,
        elementsRef.current,
      );
      applySavedRevision(saved.data);
    } catch (cause) {
      await handleSaveFailure(cause);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [applySavedRevision, handleSaveFailure, persistSnapshot]);

  // Peer-to-peer LiveKit DataChannel sync
  useEffect(() => {
    if (!room || !peerIdentity) {
      transportRef.current?.close();
      transportRef.current = null;
      return;
    }
    const transport = createRoomWhiteboardTransport({
      room,
      peerIdentity,
      onToggle: (open) => remoteToggleRef.current?.(open),
      onElements: (remote) => {
        const merged = mergeWhiteboardElements(elementsRef.current, remote);
        elementsRef.current = merged;
        setElements(merged);
      },
      onSyncRequest: () => {
        if (elementsRef.current.length) {
          transport.sendSync(elementsRef.current);
        }
      },
    });
    transportRef.current = transport;
    if (enabled) transport.requestSync();
    return () => {
      transport.close();
      if (transportRef.current === transport) transportRef.current = null;
    };
  }, [room, peerIdentity, enabled]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const mutate = useCallback(
    (next: WhiteboardElement[], changed: WhiteboardElement[]) => {
      if (readOnlyRef.current) return;
      elementsRef.current = next;
      setElements(next);
      dirtyRef.current = true;
      setDirty(true);
      transportRef.current?.sendDelta(changed);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void saveNow();
      }, 5000);
    },
    [saveNow],
  );

  const notifyToggle = useCallback(
    (open: boolean) => {
      transportRef.current?.sendToggle(open);
      if (!open) void saveNow();
    },
    [saveNow],
  );

  const readOnlyNotice = readOnly
    ? whiteboardReadOnlyMessage(readOnlyReason, editableFrom, editableUntil)
    : undefined;

  let statusText = `Phiên bản #${revision}`;
  if (saving) statusText = "Đang lưu bảng trắng…";
  else if (dirty) statusText = `Có thay đổi chưa lưu · Phiên bản #${revision}`;
  else if (updatedAt) statusText = `Đã lưu phiên bản #${revision}`;

  return {
    elements,
    revision,
    updatedAt,
    retentionDays,
    readOnly,
    readOnlyReason,
    readOnlyNotice,
    editableFrom,
    editableUntil,
    loading,
    saving,
    dirty,
    error,
    statusText,
    reload: () => void load(false),
    mutate,
    saveNow: () => void saveNow(),
    notifyToggle,
  };
}
