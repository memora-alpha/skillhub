import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { Room, RoomEvent, ConnectionState } from "livekit-client";
import { AppError } from "@/lib/http/errors";
import type { RoomMediaProps } from "../components/room-media.types";
import { acquireRoomAudio } from "../utils/room-audio.native";
import { createRoomConnection } from "../utils/room-connection";
import { canJoinSession, sessionJoinReason } from "../utils/session-join";
import { sessionErrorMessage } from "../utils/session-read";

export type RoomStatus =
  "connecting" | "connected" | "reconnecting" | "disconnected";

export function useRoomConnection({
  sessionId,
  api,
  isCurrent,
}: RoomMediaProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [error, setError] = useState("");
  const [mediaNotice, setMediaNotice] = useState("");
  const [mediaPending, setMediaPending] = useState(true);
  const connectionRef = useRef<ReturnType<typeof createRoomConnection> | null>(
    null,
  );
  useEffect(() => {
    const room = new Room({ adaptiveStream: true, dynacast: true });
    setRoom(room);
    setStatus("connecting");
    setError("");
    setMediaPending(true);
    let releaseAudio: (() => Promise<void>) | undefined;
    const stopTracks = () =>
      room.localParticipant.trackPublications.forEach((p) => p.track?.stop());
    const connection = createRoomConnection({
      isCurrent,
      load: async (signal) => {
        const session = await api.detail(sessionId, signal);
        if (signal.aborted) throw new AppError("session");
        if (!canJoinSession(session))
          throw new AppError(
            "http",
            409,
            sessionJoinReason(session) ?? "SESSION_NOT_JOINABLE",
          );
        return api.liveKitToken(sessionId, signal);
      },
      connect: async (credentials, active) => {
        releaseAudio = await acquireRoomAudio();
        if (!active()) {
          await releaseAudio();
          return;
        }
        await room.connect(credentials.serverUrl, credentials.participantToken);
      },
      disconnect: async () => {
        stopTracks();
        await Promise.allSettled([room.disconnect(), releaseAudio?.()]);
      },
      connected: () => {
        setStatus("connected");
        void publish();
      },
      failed: (cause) => {
        setStatus("disconnected");
        setError(
          cause instanceof AppError
            ? sessionErrorMessage(cause)
            : "Không kết nối được phòng học. Kiểm tra mạng và thử lại.",
        );
      },
    });
    connectionRef.current = connection;
    async function publish() {
      for (const source of ["microphone", "camera"] as const) {
        if (!connection.active() || room.state !== ConnectionState.Connected)
          break;
        try {
          const publication =
            source === "microphone"
              ? await room.localParticipant.setMicrophoneEnabled(true)
              : await room.localParticipant.setCameraEnabled(true);
          if (!connection.active()) {
            publication?.track?.stop();
            return;
          }
        } catch {
          if (connection.active())
            setMediaNotice(
              "Chưa bật được camera hoặc micro. Bạn vẫn có thể nghe và xem; hãy kiểm tra quyền rồi bật lại bằng nút bên dưới.",
            );
        }
      }
      if (connection.active()) setMediaPending(false);
    }
    const reconnecting = () => {
      if (connection.active()) setStatus("reconnecting");
    };
    const reconnected = () => {
      if (connection.active()) setStatus("connected");
    };
    const disconnected = () => {
      if (!connection.active()) return;
      setStatus("disconnected");
      setError("Kết nối phòng học đã đóng. Bạn có thể thử vào lại phòng.");
      void connection.close();
    };
    room.on(RoomEvent.Reconnecting, reconnecting);
    room.on(RoomEvent.SignalReconnecting, reconnecting);
    room.on(RoomEvent.Reconnected, reconnected);
    room.on(RoomEvent.Disconnected, disconnected);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "background") void connection.close();
    });
    void connection.start();
    return () => {
      appState.remove();
      room.off(RoomEvent.Reconnecting, reconnecting);
      room.off(RoomEvent.SignalReconnecting, reconnecting);
      room.off(RoomEvent.Reconnected, reconnected);
      room.off(RoomEvent.Disconnected, disconnected);
      void connection.close();
      if (connectionRef.current === connection) connectionRef.current = null;
    };
  }, [api, isCurrent, sessionId]);
  return {
    room,
    status,
    error,
    mediaNotice,
    mediaPending,
    active: () => !!connectionRef.current?.active(),
    mediaFailed: () =>
      setMediaNotice(
        "Không thay đổi được camera hoặc micro. Kiểm tra quyền truy cập trong cài đặt thiết bị và thử lại.",
      ),
    mediaSucceeded: () => setMediaNotice(""),
    close: () => {
      void connectionRef.current?.close();
    },
  };
}
