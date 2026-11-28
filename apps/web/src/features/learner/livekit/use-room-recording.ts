"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RoomEvent, type Room } from "livekit-client";
import { useUserSession } from "../auth/session";
import { UserApiError } from "../api/client";
import type { SessionRecording } from "../types";
import {
  createRecordingTracker,
  reconcileLiveRecording,
  reconcileRecordingItems,
  seedLiveRecording,
  upsertRecordingItem,
  type RecordingTransitionEffect,
} from "./recording-state";

type RoomRecordingMetadata = {
  id: string;
  kind: string;
} | null;

type ActiveNotice = {
  id: number;
  text: string;
  autoHideMs?: number;
};

function parseRoomRecordingMetadata(
  raw: string | undefined,
): RoomRecordingMetadata {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      recording?: { id?: unknown; kind?: unknown } | null;
    };
    const rec = parsed?.recording;
    if (rec && typeof rec.id === "string" && typeof rec.kind === "string") {
      return { id: rec.id, kind: rec.kind };
    }
    return null;
  } catch {
    return null;
  }
}

function recordingActionErrorMessage(cause: unknown): string {
  if (
    cause instanceof UserApiError &&
    cause.status === 503 &&
    cause.code === "API_UNAVAILABLE"
  ) {
    return "Tính năng ghi hình hiện chưa được bật hoặc máy chủ chưa cấu hình dịch vụ ghi hình (HTTP 503).";
  }
  if (cause instanceof Error) return cause.message;
  return "Không thực hiện được thao tác ghi hình.";
}

export function useRoomRecording(
  sessionId: string,
  room: Room | null,
  enabled: boolean,
) {
  const { actor, request } = useUserSession();
  const [items, setItems] = useState<SessionRecording[]>([]);
  const [metadataRecording, setMetadataRecording] =
    useState<RoomRecordingMetadata>(null);
  const [sdkRecording, setSdkRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [noticeState, setNoticeState] = useState<ActiveNotice>();
  const aliveRef = useRef(true);
  const trackerRef = useRef(createRecordingTracker());
  const itemsRef = useRef<SessionRecording[]>([]);
  const liveMetaRef = useRef<{ recording: boolean; id: string | null }>({
    recording: false,
    id: null,
  });
  const noticeSeqRef = useRef(0);
  const loadSeqRef = useRef(0);

  const applyEffect = useCallback((effect: RecordingTransitionEffect) => {
    if (!aliveRef.current) return;
    if (effect.notice === null) {
      setNoticeState(undefined);
    } else if (effect.notice) {
      noticeSeqRef.current += 1;
      setNoticeState({
        id: noticeSeqRef.current,
        text: effect.notice.text,
        autoHideMs: effect.notice.autoHideMs,
      });
    }
    if (effect.error === null) {
      setError(undefined);
    } else if (effect.error !== undefined) {
      setError(effect.error);
    }
  }, []);

  const commitItems = useCallback(
    (nextItems: SessionRecording[]) => {
      itemsRef.current = nextItems;
      setItems(nextItems);
      const { tracker, effect } = reconcileRecordingItems(
        trackerRef.current,
        nextItems,
        liveMetaRef.current.recording,
        liveMetaRef.current.id,
        actor.userId,
      );
      trackerRef.current = tracker;
      applyEffect(effect);
    },
    [actor.userId, applyEffect],
  );

  const commitMutatedItem = useCallback(
    (item: SessionRecording) => {
      if (!aliveRef.current) return;
      loadSeqRef.current += 1;
      commitItems(upsertRecordingItem(itemsRef.current, item));
    },
    [commitItems],
  );

  const load = useCallback(async () => {
    if (!enabled) return;
    const seq = ++loadSeqRef.current;
    try {
      const res = await request<{ items: SessionRecording[] }>(
        `sessions/${sessionId}/recordings`,
      );
      if (aliveRef.current && seq === loadSeqRef.current) {
        commitItems(res.data.items);
      }
    } catch {
      /* Polling errors stay non-blocking inside the live room. */
    }
  }, [commitItems, enabled, request, sessionId]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!noticeState?.autoHideMs) return;
    const timer = setTimeout(() => {
      setNoticeState((current) =>
        current?.id === noticeState.id ? undefined : current,
      );
    }, noticeState.autoHideMs);
    return () => clearTimeout(timer);
  }, [noticeState]);

  useEffect(() => {
    if (enabled) return;
    loadSeqRef.current += 1;
    trackerRef.current = createRecordingTracker();
    itemsRef.current = [];
    liveMetaRef.current = { recording: false, id: null };
    const reset = setTimeout(() => {
      if (!aliveRef.current) return;
      setItems([]);
      setMetadataRecording(null);
      setSdkRecording(false);
      setError(undefined);
      setNoticeState(undefined);
    }, 0);
    return () => clearTimeout(reset);
  }, [enabled, sessionId]);

  useEffect(() => {
    if (!room || !enabled) return;

    const initialMeta = parseRoomRecordingMetadata(room.metadata);
    const initialSdk = room.isRecording;
    liveMetaRef.current = {
      recording: Boolean(initialMeta) || initialSdk,
      id: initialMeta?.id ?? null,
    };
    trackerRef.current = seedLiveRecording(
      trackerRef.current,
      liveMetaRef.current.recording,
      liveMetaRef.current.id,
    );

    const syncRoomMeta = () => {
      const meta = parseRoomRecordingMetadata(room.metadata);
      const sdk = room.isRecording;
      liveMetaRef.current = {
        recording: Boolean(meta) || sdk,
        id: meta?.id ?? null,
      };
      setMetadataRecording(meta);
      setSdkRecording(sdk);
      return liveMetaRef.current;
    };

    const onLiveRoomChange = () => {
      const live = syncRoomMeta();
      const { tracker, effect } = reconcileLiveRecording(
        trackerRef.current,
        live.recording,
        live.id,
        itemsRef.current,
      );
      trackerRef.current = tracker;
      applyEffect(effect);
      void load();
    };

    const initial = setTimeout(() => {
      const live = syncRoomMeta();
      trackerRef.current = seedLiveRecording(
        trackerRef.current,
        live.recording,
        live.id,
      );
    }, 0);
    room.on(RoomEvent.RoomMetadataChanged, onLiveRoomChange);
    room.on(RoomEvent.RecordingStatusChanged, onLiveRoomChange);
    room.on(RoomEvent.Reconnected, onLiveRoomChange);
    return () => {
      clearTimeout(initial);
      room.off(RoomEvent.RoomMetadataChanged, onLiveRoomChange);
      room.off(RoomEvent.RecordingStatusChanged, onLiveRoomChange);
      room.off(RoomEvent.Reconnected, onLiveRoomChange);
    };
  }, [room, enabled, load, applyEffect]);

  const active = items.find((item) =>
    ["REQUESTED", "STARTING", "RECORDING", "STOPPING"].includes(item.status),
  );
  const hasActive = Boolean(active);

  useEffect(() => {
    if (!enabled) return;
    const kickoff = setTimeout(() => void load(), 0);
    const intervalMs = hasActive ? 5000 : 15000;
    const timer = setInterval(() => void load(), intervalMs);
    return () => {
      clearTimeout(kickoff);
      clearInterval(timer);
    };
  }, [enabled, hasActive, load]);

  const isRecording =
    enabled &&
    ((room ? Boolean(metadataRecording) || sdkRecording : false) ||
      active?.status === "RECORDING");

  const pendingConsentForMe =
    !isRecording &&
    active?.status === "REQUESTED" &&
    active.requestedByUserId !== actor.userId
      ? active
      : null;

  const waitingForPartner =
    !isRecording &&
    active?.status === "REQUESTED" &&
    active.requestedByUserId === actor.userId
      ? active
      : null;

  async function runAction(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    setNoticeState(undefined);
    try {
      await work();
      await load();
    } catch (cause) {
      if (aliveRef.current) {
        setError(recordingActionErrorMessage(cause));
      }
      await load();
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }

  return {
    items,
    active,
    isRecording,
    pendingConsentForMe,
    waitingForPartner,
    busy,
    error: enabled ? error : undefined,
    notice: enabled ? noticeState?.text : undefined,
    requestRecording: () =>
      runAction(async () => {
        const res = await request<SessionRecording>(
          `sessions/${sessionId}/recordings`,
          { method: "POST" },
        );
        commitMutatedItem(res.data);
      }),
    acceptRecording: (recordingId: string) =>
      runAction(async () => {
        const res = await request<SessionRecording>(
          `sessions/${sessionId}/recordings/${recordingId}/accept`,
          { method: "POST" },
        );
        commitMutatedItem(res.data);
      }),
    declineRecording: (recordingId: string) =>
      runAction(async () => {
        const res = await request<SessionRecording>(
          `sessions/${sessionId}/recordings/${recordingId}/decline`,
          { method: "POST" },
        );
        commitMutatedItem(res.data);
      }),
    stopRecording: (recordingId: string) =>
      runAction(async () => {
        const res = await request<SessionRecording>(
          `sessions/${sessionId}/recordings/${recordingId}/stop`,
          { method: "POST" },
        );
        commitMutatedItem(res.data);
      }),
  };
}
