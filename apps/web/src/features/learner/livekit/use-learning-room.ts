"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { Room, Track, LocalTrackPublication } from "livekit-client";
import { useUserSession } from "../auth/session";
import type { LearningSession, LiveKitCredentials } from "../types";
import { UserApiError } from "../api/client";
import {
  canEnterSession,
  validRoomCredentials,
  mediaErrorMessage,
} from "../sessions/session-policy";
export function useLearningRoom(
  sessionId: string,
  videoRef: RefObject<HTMLDivElement | null>,
  audioRef: RefObject<HTMLDivElement | null>,
) {
  const { actor, request } = useUserSession();
  const roomRef = useRef<Room | null>(null),
    tracks = useRef(new Set<Track>()),
    joining = useRef(false),
    attempt = useRef(0),
    alive = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [status, setStatus] = useState("disconnected"),
    [error, setError] = useState<string>(),
    [notice, setNotice] = useState<string>();
  const [camera, setCamera] = useState(false),
    [microphone, setMicrophone] = useState(false),
    [screen, setScreen] = useState(false),
    [audioBlocked, setAudioBlocked] = useState(false),
    [mediaBusy, setMediaBusy] = useState(false),
    [participants, setParticipants] = useState(0);
  const close = useCallback(() => {
    attempt.current++;
    joining.current = false;
    if (timer.current) clearTimeout(timer.current);
    tracks.current.forEach((track) =>
      track.detach().forEach((element) => element.remove()),
    );
    tracks.current.clear();
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      room.removeAllListeners();
      void room.disconnect(true).catch(() => undefined);
    }
    if (alive.current) {
      setStatus("disconnected");
      setCamera(false);
      setMicrophone(false);
      setScreen(false);
      setParticipants(0);
      setMediaBusy(false);
      setAudioBlocked(false);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    const leavePage = () => close();
    window.addEventListener("pagehide", leavePage);
    return () => {
      alive.current = false;
      window.removeEventListener("pagehide", leavePage);
      close();
    };
  }, [close, sessionId]);
  async function join() {
    if (roomRef.current || joining.current) return;
    joining.current = true;
    const ticket = ++attempt.current,
      active = () => alive.current && attempt.current === ticket;
    setStatus("connecting");
    setError(undefined);
    setNotice(undefined);
    try {
      const fresh = (await request<LearningSession>("sessions/" + sessionId))
        .data;
      if (!active()) return;
      if (!canEnterSession(fresh))
        throw new UserApiError(
          409,
          fresh.join?.reason ?? "SESSION_NOT_JOINABLE",
        );
      const credentials = (
        await request<LiveKitCredentials>(
          "sessions/" + sessionId + "/livekit-token",
          { method: "POST", body: {} },
        )
      ).data;
      if (!active()) return;
      if (!validRoomCredentials(credentials, sessionId, actor.userId))
        throw new UserApiError(502, "API_RESPONSE_INVALID");
      const {
        Room: LiveRoom,
        RoomEvent,
        Track: LiveTrack,
      } = await import("livekit-client");
      if (!active()) return;
      const room = new LiveRoom({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      const detach = (track: Track) => {
        track.detach().forEach((element) => element.remove());
        tracks.current.delete(track);
      };
      const attach = (track: Track, local = false) => {
        if (
          !active() ||
          tracks.current.has(track) ||
          (local && track.kind === LiveTrack.Kind.Audio)
        )
          return;
        tracks.current.add(track);
        const element = track.attach();
        element.autoplay = true;
        if (element instanceof HTMLVideoElement) {
          element.playsInline = true;
          element.muted = local;
          element.setAttribute(
            "aria-label",
            local ? "Video của bạn" : "Video đối tác",
          );
          videoRef.current?.appendChild(element);
        } else audioRef.current?.appendChild(element);
      };
      const mediaChanged = () => {
        if (active()) {
          setCamera(room.localParticipant.isCameraEnabled);
          setMicrophone(room.localParticipant.isMicrophoneEnabled);
          setScreen(room.localParticipant.isScreenShareEnabled);
        }
      };
      room.on(RoomEvent.TrackSubscribed, (track) => attach(track));
      room.on(RoomEvent.TrackUnsubscribed, detach);
      room.on(RoomEvent.LocalTrackPublished, (publication) => {
        if (publication.track) attach(publication.track, true);
        mediaChanged();
      });
      room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.track) detach(publication.track);
        mediaChanged();
      });
      room.on(RoomEvent.TrackMuted, mediaChanged);
      room.on(RoomEvent.TrackUnmuted, mediaChanged);
      room.on(RoomEvent.ParticipantConnected, () => {
        if (active()) setParticipants(room.remoteParticipants.size);
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        if (active()) setParticipants(room.remoteParticipants.size);
      });
      room.on(RoomEvent.ConnectionStateChanged, (value) => {
        if (active()) setStatus(value);
      });
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (active()) setAudioBlocked(!room.canPlaybackAudio);
      });
      room.on(RoomEvent.MediaDevicesError, (cause) => {
        if (active()) setNotice(mediaErrorMessage(cause));
      });
      room.on(RoomEvent.Disconnected, () => {
        if (active()) {
          setNotice(
            "Đã ngắt kết nối phòng học. Kiểm tra trạng thái buổi học trước khi kết nối lại.",
          );
          close();
        }
      });
      const end = Math.min(
        Date.parse(fresh.endAt),
        Date.parse(credentials.joinClosesAt),
      );
      timer.current = setTimeout(
        () => {
          if (active()) {
            setNotice(
              "Đã hết thời gian phòng học. Quay lại chi tiết để xem điểm danh.",
            );
            close();
          }
        },
        Math.max(0, end - Date.now()),
      );
      await room.connect(credentials.serverUrl, credentials.participantToken);
      if (!active()) {
        await room.disconnect(true);
        return;
      }
      setStatus("connected");
      setParticipants(room.remoteParticipants.size);
      setAudioBlocked(!room.canPlaybackAudio);
      room.remoteParticipants.forEach((participant) =>
        participant.trackPublications.forEach((publication) => {
          if (publication.track) attach(publication.track);
        }),
      );
    } catch (cause) {
      if (!active()) return;
      close();
      setError(
        cause instanceof UserApiError
          ? cause.message
          : "Không kết nối được phòng học. Kiểm tra mạng rồi thử lại.",
      );
    } finally {
      if (attempt.current === ticket) joining.current = false;
    }
  }
  async function toggle(kind: "camera" | "microphone" | "screen") {
    const room = roomRef.current;
    if (!room || mediaBusy || room.state !== "connected") return;
    const ticket = attempt.current;
    setMediaBusy(true);
    setNotice(undefined);
    try {
      let publication: LocalTrackPublication | undefined;
      if (kind === "camera")
        publication = await room.localParticipant.setCameraEnabled(
          !room.localParticipant.isCameraEnabled,
        );
      if (kind === "microphone")
        publication = await room.localParticipant.setMicrophoneEnabled(
          !room.localParticipant.isMicrophoneEnabled,
        );
      if (kind === "screen")
        publication = await room.localParticipant.setScreenShareEnabled(
          !room.localParticipant.isScreenShareEnabled,
        );
      if (!alive.current || attempt.current !== ticket) {
        publication?.track?.stop();
        await room.disconnect(true).catch(() => undefined);
        return;
      }
      if (alive.current && attempt.current === ticket) {
        setCamera(room.localParticipant.isCameraEnabled);
        setMicrophone(room.localParticipant.isMicrophoneEnabled);
        setScreen(room.localParticipant.isScreenShareEnabled);
      }
    } catch (cause) {
      if (alive.current && attempt.current === ticket)
        setNotice(mediaErrorMessage(cause));
    } finally {
      if (alive.current && attempt.current === ticket) setMediaBusy(false);
    }
  }
  function startAudio() {
    const room = roomRef.current;
    if (!room) return;
    void room
      .startAudio()
      .then(() => {
        if (roomRef.current === room) setAudioBlocked(!room.canPlaybackAudio);
      })
      .catch(() => {
        if (roomRef.current === room)
          setNotice(
            "Trình duyệt chưa cho phép phát âm thanh. Bấm Bật âm thanh để thử lại.",
          );
      });
  }
  return {
    status,
    error,
    notice,
    camera,
    microphone,
    screen,
    audioBlocked,
    mediaBusy,
    participants,
    join,
    close,
    toggle,
    startAudio,
  };
}
