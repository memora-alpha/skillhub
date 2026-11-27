"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RoomEvent, type Room } from "livekit-client";
import { useUserSession } from "../auth/session";
import { UserApiError } from "../api/client";
import type { SessionRecording } from "../types";

type RoomRecordingMetadata = {
  id: string;
  kind: string;
} | null;

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
  const [notice, setNotice] = useState<string>();
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await request<{ items: SessionRecording[] }>(
        `sessions/${sessionId}/recordings`,
      );
      if (aliveRef.current) {
        setItems(res.data.items);
      }
    } catch {
      /* Polling errors stay non-blocking inside the live room. */
    }
  }, [enabled, request, sessionId]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!room) return;
    const syncRoomMeta = () => {
      setMetadataRecording(parseRoomRecordingMetadata(room.metadata));
      setSdkRecording(room.isRecording);
    };
    const onMetadataChanged = () => {
      syncRoomMeta();
      void load();
    };
    const onRecordingChanged = () => {
      syncRoomMeta();
      void load();
    };
    const initial = setTimeout(syncRoomMeta, 0);
    room.on(RoomEvent.RoomMetadataChanged, onMetadataChanged);
    room.on(RoomEvent.RecordingStatusChanged, onRecordingChanged);
    room.on(RoomEvent.Reconnected, onMetadataChanged);
    return () => {
      clearTimeout(initial);
      room.off(RoomEvent.RoomMetadataChanged, onMetadataChanged);
      room.off(RoomEvent.RecordingStatusChanged, onRecordingChanged);
      room.off(RoomEvent.Reconnected, onMetadataChanged);
    };
  }, [room, load]);

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
    (room ? Boolean(metadataRecording) || sdkRecording : false) ||
    active?.status === "RECORDING";

  const pendingConsentForMe =
    active?.status === "REQUESTED" && active.requestedByUserId !== actor.userId
      ? active
      : null;

  const waitingForPartner =
    active?.status === "REQUESTED" && active.requestedByUserId === actor.userId
      ? active
      : null;

  async function runAction(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
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
    error,
    notice,
    requestRecording: () =>
      runAction(async () => {
        await request<SessionRecording>(`sessions/${sessionId}/recordings`, {
          method: "POST",
        });
        if (aliveRef.current)
          setNotice(
            "Đã gửi yêu cầu ghi hình. Đang chờ đối phương đồng ý (hết hạn sau 2 phút).",
          );
      }),
    acceptRecording: (recordingId: string) =>
      runAction(async () => {
        await request<SessionRecording>(
          `sessions/${sessionId}/recordings/${recordingId}/accept`,
          { method: "POST" },
        );
        if (aliveRef.current)
          setNotice("Đã đồng ý ghi hình. Hệ thống đang khởi tạo bản ghi.");
      }),
    declineRecording: (recordingId: string) =>
      runAction(async () => {
        await request<SessionRecording>(
          `sessions/${sessionId}/recordings/${recordingId}/decline`,
          { method: "POST" },
        );
        if (aliveRef.current) setNotice("Đã từ chối yêu cầu ghi hình.");
      }),
    stopRecording: (recordingId: string) =>
      runAction(async () => {
        await request<SessionRecording>(
          `sessions/${sessionId}/recordings/${recordingId}/stop`,
          { method: "POST" },
        );
        if (aliveRef.current)
          setNotice(
            "Đang dừng ghi hình. Bản ghi sẽ xuất hiện trong chi tiết buổi học sau khi xử lý xong.",
          );
      }),
  };
}
