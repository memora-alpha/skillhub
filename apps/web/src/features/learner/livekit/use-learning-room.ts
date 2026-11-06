"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Room,
  LocalTrack,
  LocalTrackPublication,
  LocalVideoTrack,
  LocalAudioTrack,
} from "livekit-client";
import type { CameraBackground } from "./use-camera-background";
import type { RoomAudio } from "./use-room-audio";
import type { RoomDevices, DeviceKind } from "./use-room-devices";
import {
  microphoneCaptureOptions,
  type BackgroundSettings,
  type MicrophoneSettings,
} from "./media-settings";
import {
  MicrophoneCancelledError,
  MicrophoneEffectError,
} from "./microphone-processor";
import { roomMedia } from "./room-media";
import { publishRoomTrack } from "./publish-room-track";
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
  background: CameraBackground,
  audio: RoomAudio,
  devices: RoomDevices,
) {
  const { actor, request } = useUserSession();
  const roomRef = useRef<Room | null>(null),
    pendingTracks = useRef(new Set<LocalTrack>()),
    mediaLock = useRef(false),
    joining = useRef(false),
    attempt = useRef(0),
    alive = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [status, setStatus] = useState("disconnected"),
    [error, setError] = useState<string>(),
    [notice, setNotice] = useState<string>();
  const [connectedRoom, setConnectedRoom] = useState<Room | null>(null);
  const [microphoneTrack, setMicrophoneTrack] = useState<LocalAudioTrack>();
  const [camera, setCamera] = useState(false),
    [microphone, setMicrophone] = useState(false),
    [screen, setScreen] = useState(false),
    [audioBlocked, setAudioBlocked] = useState(false),
    [mediaBusy, setMediaBusy] = useState(false),
    [participants, setParticipants] = useState(0);
  const [media, setMedia] = useState<ReturnType<typeof roomMedia>>({
    tiles: [],
    audio: [],
  });
  const close = useCallback(() => {
    attempt.current++;
    joining.current = false;
    mediaLock.current = false;
    if (timer.current) clearTimeout(timer.current);
    pendingTracks.current.forEach((track) => track.stop());
    pendingTracks.current.clear();
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      room.removeAllListeners();
      void room.disconnect(true).catch(() => undefined);
    }
    if (alive.current) {
      setConnectedRoom(null);
      setStatus("disconnected");
      setCamera(false);
      setMicrophone(false);
      setMicrophoneTrack(undefined);
      setScreen(false);
      setParticipants(0);
      setMediaBusy(false);
      setAudioBlocked(false);
      setMedia({ tiles: [], audio: [] });
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
  async function join(previewTracks: LocalTrack[] = []) {
    if (roomRef.current || joining.current) {
      previewTracks.forEach((track) => track.stop());
      return;
    }
    previewTracks.forEach((track) => pendingTracks.current.add(track));
    joining.current = true;
    const ticket = ++attempt.current,
      active = () => alive.current && attempt.current === ticket;
    setStatus("connecting");
    setMediaBusy(true);
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
        Track,
      } = await import("livekit-client");
      if (!active()) return;
      const audioContext = audio.getContext();
      const room = new LiveRoom({
        adaptiveStream: true,
        dynacast: true,
        webAudioMix: audioContext ? { audioContext } : false,
      });
      roomRef.current = room;
      setConnectedRoom(room);
      const mediaChanged = () => {
        if (active()) {
          setCamera(room.localParticipant.isCameraEnabled);
          setMicrophone(room.localParticipant.isMicrophoneEnabled);
          setMicrophoneTrack(
            room.localParticipant.getTrackPublication(Track.Source.Microphone)
              ?.track as LocalAudioTrack | undefined,
          );
          setScreen(room.localParticipant.isScreenShareEnabled);
          setParticipants(room.remoteParticipants.size);
          setMedia(roomMedia(room, actor.profile.fullName));
        }
      };
      room.on(RoomEvent.TrackSubscribed, mediaChanged);
      room.on(RoomEvent.TrackUnsubscribed, mediaChanged);
      room.on(RoomEvent.TrackPublished, mediaChanged);
      room.on(RoomEvent.TrackUnpublished, mediaChanged);
      room.on(RoomEvent.LocalTrackPublished, mediaChanged);
      room.on(RoomEvent.LocalTrackUnpublished, mediaChanged);
      room.on(RoomEvent.TrackMuted, mediaChanged);
      room.on(RoomEvent.TrackUnmuted, mediaChanged);
      room.on(RoomEvent.ParticipantConnected, mediaChanged);
      room.on(RoomEvent.ParticipantDisconnected, mediaChanged);
      room.on(RoomEvent.ParticipantNameChanged, mediaChanged);
      room.on(RoomEvent.ActiveSpeakersChanged, mediaChanged);
      room.on(RoomEvent.Reconnected, mediaChanged);
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
      const end = Date.parse(credentials.joinClosesAt);
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
      // Keep track publication sequential, including microphone preparation.
      await previewTracks.reduce(
        (previous, track) =>
          previous.then(() => publishPreviewTrack(room, track, active)),
        Promise.resolve(),
      );
      if (!active()) {
        await room.disconnect(true);
        return;
      }
      setStatus("connected");
      setMediaBusy(false);
      mediaChanged();
      setAudioBlocked(!room.canPlaybackAudio);
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
  async function publishPreviewTrack(
    room: Room,
    track: LocalTrack,
    active: () => boolean,
  ) {
    try {
      if (!active()) {
        track.stop();
        return;
      }
      await publishRoomTrack(
        room,
        track,
        active,
        track.kind === "audio" && audio.settings.filter !== "standard"
          ? () => audio.prepare(track as LocalAudioTrack, active, room)
          : undefined,
      );
    } catch (cause) {
      track.stop();
      if (active())
        setNotice(
          cause instanceof MicrophoneEffectError
            ? cause.message
            : mediaErrorMessage(cause),
        );
    } finally {
      pendingTracks.current.delete(track);
    }
  }
  async function toggle(kind: "camera" | "microphone" | "screen") {
    const room = roomRef.current;
    if (
      !room ||
      mediaBusy ||
      mediaLock.current ||
      background.busy ||
      audio.busy ||
      room.state !== "connected"
    )
      return;
    const ticket = attempt.current;
    const active = () => alive.current && attempt.current === ticket;
    mediaLock.current = true;
    setMediaBusy(true);
    setNotice(undefined);
    try {
      let publication: LocalTrackPublication | undefined;
      if (kind !== "screen")
        publication = await toggleCapture(room, kind, ticket);
      if (kind === "screen")
        publication = await room.localParticipant.setScreenShareEnabled(
          !room.localParticipant.isScreenShareEnabled,
          { audio: true, contentHint: "detail", surfaceSwitching: "include" },
        );
      if (!active()) {
        publication?.track?.stop();
        await room.disconnect(true).catch(() => undefined);
        return;
      }
      if (active()) {
        setCamera(room.localParticipant.isCameraEnabled);
        setMicrophone(room.localParticipant.isMicrophoneEnabled);
        setScreen(room.localParticipant.isScreenShareEnabled);
      }
    } catch (cause) {
      if (active()) {
        let message = mediaErrorMessage(cause);
        if (kind === "camera" && background.enabled)
          message =
            "Chưa bật được camera với nền mờ. Kiểm tra mạng rồi thử lại, hoặc tắt mờ nền để bật camera.";
        else if (cause instanceof MicrophoneEffectError)
          message = cause.message;
        setNotice(message);
      }
    } finally {
      if (active()) {
        mediaLock.current = false;
        setMediaBusy(false);
      }
    }
  }
  async function toggleCapture(room: Room, kind: DeviceKind, ticket: number) {
    const active = () => alive.current && attempt.current === ticket;
    const { Track } = await import("livekit-client");
    if (!active()) return;
    const current = room.localParticipant.getTrackPublication(
      kind === "camera" ? Track.Source.Camera : Track.Source.Microphone,
    );
    const enabled =
      kind === "camera"
        ? room.localParticipant.isCameraEnabled
        : room.localParticipant.isMicrophoneEnabled;
    if (current?.track && enabled) {
      await room.localParticipant.unpublishTrack(current.track, true);
    } else {
      if (current?.track)
        await room.localParticipant.unpublishTrack(current.track, true);
      return captureAndPublish(room, kind, devices.selected[kind], ticket);
    }
  }
  async function captureAndPublish(
    room: Room,
    kind: DeviceKind,
    deviceId: string,
    ticket: number,
    micSettings = audio.settings,
  ) {
    const active = () => alive.current && attempt.current === ticket;
    if (!active()) throw new MicrophoneCancelledError();
    const sdk = await import("livekit-client");
    if (!active()) throw new MicrophoneCancelledError();
    const captureOptions = deviceId ? { deviceId: { exact: deviceId } } : {};
    const track =
      kind === "camera"
        ? await sdk.createLocalVideoTrack(captureOptions)
        : await sdk.createLocalAudioTrack(
            microphoneCaptureOptions(micSettings, deviceId),
          );
    pendingTracks.current.add(track);
    try {
      if (!active()) throw new MicrophoneCancelledError();
      if (kind === "camera")
        await background.prepare(track as LocalVideoTrack, active);
      else if (micSettings.filter === "standard")
        await audio.prepare(
          track as LocalAudioTrack,
          active,
          room,
          micSettings,
        );
      if (!active()) throw new MicrophoneCancelledError();
      const publication = await publishRoomTrack(
        room,
        track,
        active,
        kind === "microphone" && micSettings.filter !== "standard"
          ? () =>
              audio.prepare(track as LocalAudioTrack, active, room, micSettings)
          : undefined,
      );
      if (!active()) throw new MicrophoneCancelledError();
      await devices.refresh();
      return publication;
    } catch (cause) {
      track.stop();
      throw cause;
    } finally {
      pendingTracks.current.delete(track);
    }
  }

  async function switchDevice(
    kind: DeviceKind,
    deviceId: string,
    micSettings = audio.settings,
    fromSettings = false,
  ) {
    const room = roomRef.current;
    if (
      !room ||
      mediaBusy ||
      mediaLock.current ||
      background.busy ||
      (audio.busy && !fromSettings) ||
      room.state !== "connected"
    )
      return;
    const ticket = attempt.current;
    const active = () => alive.current && attempt.current === ticket;
    mediaLock.current = true;
    setMediaBusy(true);
    setNotice(undefined);
    try {
      const { Track } = await import("livekit-client");
      if (!active()) return;
      const current = room.localParticipant.getTrackPublication(
        kind === "camera" ? Track.Source.Camera : Track.Source.Microphone,
      );
      const enabled =
        kind === "camera"
          ? room.localParticipant.isCameraEnabled
          : room.localParticipant.isMicrophoneEnabled;
      if (current?.track && enabled) {
        await room.localParticipant.unpublishTrack(current.track, true);
        await captureAndPublish(room, kind, deviceId, ticket, micSettings);
      }
      if (active()) devices.select(kind, deviceId);
    } catch (cause) {
      if (fromSettings) throw cause;
      if (active()) setNotice(mediaErrorMessage(cause));
    } finally {
      if (active()) {
        mediaLock.current = false;
        setMediaBusy(false);
        setCamera(room.localParticipant.isCameraEnabled);
        setMicrophone(room.localParticipant.isMicrophoneEnabled);
      }
    }
  }

  async function changeAudio(next: MicrophoneSettings) {
    const room = roomRef.current;
    if (
      !room ||
      mediaBusy ||
      mediaLock.current ||
      background.busy ||
      audio.busy ||
      room.state !== "connected"
    )
      return;
    const ticket = attempt.current;
    await audio.change(
      next,
      async (settings) => {
        await switchDevice(
          "microphone",
          devices.selected.microphone,
          settings,
          true,
        );
      },
      () => alive.current && attempt.current === ticket,
    );
  }

  async function changeBackground(next: BackgroundSettings) {
    const room = roomRef.current;
    if (
      !room ||
      mediaBusy ||
      mediaLock.current ||
      background.busy ||
      audio.busy ||
      room.state !== "connected"
    )
      return;
    const ticket = attempt.current;
    mediaLock.current = true;
    setMediaBusy(true);
    try {
      const { Track } = await import("livekit-client");
      if (!alive.current || attempt.current !== ticket) return;
      const track = room.localParticipant.getTrackPublication(
        Track.Source.Camera,
      )?.track as LocalVideoTrack | undefined;
      await background.change(
        next,
        track,
        () => alive.current && attempt.current === ticket,
      );
      if (
        alive.current &&
        attempt.current === ticket &&
        track?.mediaStreamTrack.readyState === "ended"
      ) {
        await room.localParticipant
          .unpublishTrack(track, true)
          .catch(() => undefined);
        if (alive.current && attempt.current === ticket) setCamera(false);
      }
    } catch (cause) {
      if (alive.current && attempt.current === ticket)
        setNotice(mediaErrorMessage(cause));
    } finally {
      if (alive.current && attempt.current === ticket) {
        mediaLock.current = false;
        setMediaBusy(false);
      }
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
    room: connectedRoom,
    status,
    error,
    notice,
    camera,
    microphone,
    microphoneTrack,
    screen,
    audioBlocked,
    mediaBusy,
    participants,
    tiles: media.tiles,
    audio: media.audio,
    join,
    close,
    toggle,
    changeBackground,
    changeAudio,
    switchDevice,
    startAudio,
  };
}
