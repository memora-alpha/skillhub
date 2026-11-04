"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LocalTrack,
  LocalVideoTrack,
  LocalAudioTrack,
} from "livekit-client";
import { mediaErrorMessage } from "../sessions/session-policy";
import type { CameraBackground } from "./use-camera-background";
import type { RoomAudio } from "./use-room-audio";
import type { RoomDevices, DeviceKind } from "./use-room-devices";
import {
  microphoneCaptureOptions,
  type MicrophoneSettings,
  type BackgroundSettings,
} from "./media-settings";

export function useRoomPreview(
  background: CameraBackground,
  audio: RoomAudio,
  roomDevices: RoomDevices,
) {
  const owned = useRef<Partial<Record<DeviceKind, LocalTrack>>>({});
  const alive = useRef(false);
  const operation = useRef(0);
  const locked = useRef(false);
  const [tracks, setTracks] = useState<Partial<Record<DeviceKind, LocalTrack>>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const stop = useCallback(() => {
    operation.current++;
    for (const track of Object.values(owned.current)) track?.stop();
    owned.current = {};
    locked.current = false;
    if (alive.current) {
      setTracks({});
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    window.addEventListener("pagehide", stop);
    return () => {
      alive.current = false;
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, [stop]);

  async function prepareTrack(
    kind: DeviceKind,
    track: LocalTrack,
    current: () => boolean,
    settings: MicrophoneSettings,
  ) {
    if (kind === "camera")
      await background.prepare(track as LocalVideoTrack, current);
    else
      await audio.prepare(
        track as LocalAudioTrack,
        current,
        undefined,
        settings,
      );
  }
  function captureFailed(
    kind: DeviceKind,
    captured: LocalTrack | undefined,
    cause: unknown,
    current: () => boolean,
  ) {
    captured?.stop();
    if (owned.current[kind] === captured) delete owned.current[kind];
    if (current()) {
      setTracks({ ...owned.current });
      setError(
        kind === "camera" && background.enabled
          ? "Chưa làm mờ được nền nên camera vẫn tắt. Kiểm tra mạng rồi bật lại camera, hoặc tắt mờ nền để tiếp tục."
          : mediaErrorMessage(cause),
      );
    }
  }
  async function capture(
    kind: DeviceKind,
    deviceId: string,
    micSettings = audio.settings,
    fromSettings = false,
  ) {
    if (locked.current || background.busy || (audio.busy && !fromSettings))
      return;
    locked.current = true;
    const ticket = ++operation.current;
    const current = () => alive.current && ticket === operation.current;
    setBusy(true);
    setError(undefined);
    owned.current[kind]?.stop();
    delete owned.current[kind];
    setTracks({ ...owned.current });
    let captured: LocalTrack | undefined;
    try {
      const sdk = await import("livekit-client");
      if (!current()) return;
      const options = deviceId ? { deviceId: { exact: deviceId } } : {};
      const track =
        kind === "camera"
          ? await sdk.createLocalVideoTrack(options)
          : await sdk.createLocalAudioTrack(
              microphoneCaptureOptions(micSettings, deviceId),
            );
      captured = track;
      if (!current()) {
        track.stop();
        return;
      }
      owned.current[kind] = track;
      await prepareTrack(kind, track, current, micSettings);
      if (!current()) {
        track.stop();
        return;
      }
      track.mediaStreamTrack.addEventListener(
        "ended",
        () => {
          if (owned.current[kind] !== track || !alive.current) return;
          delete owned.current[kind];
          setTracks({ ...owned.current });
          setError(
            "Thiết bị đã ngắt. Chọn thiết bị khác hoặc bật lại để thử lại.",
          );
        },
        { once: true },
      );
      setTracks({ ...owned.current });
      await roomDevices.refresh();
    } catch (cause) {
      captureFailed(kind, captured, cause, current);
      if (fromSettings) throw cause;
    } finally {
      if (current()) {
        locked.current = false;
        setBusy(false);
      }
    }
  }

  function toggle(kind: DeviceKind) {
    if (locked.current || background.busy || audio.busy) return;
    const track = owned.current[kind];
    if (track) {
      delete owned.current[kind];
      track.stop();
      setTracks({ ...owned.current });
      setError(undefined);
    } else void capture(kind, roomDevices.selected[kind]);
  }

  function select(kind: DeviceKind, deviceId: string) {
    if (locked.current || background.busy || audio.busy) return;
    roomDevices.select(kind, deviceId);
    if (owned.current[kind]) void capture(kind, deviceId);
  }

  async function changeBackground(next: BackgroundSettings) {
    if (locked.current || background.busy || audio.busy) return;
    const ticket = operation.current;
    const track = owned.current.camera as LocalVideoTrack | undefined;
    await background.change(
      next,
      track,
      () => alive.current && ticket === operation.current,
    );
    if (
      alive.current &&
      ticket === operation.current &&
      track?.mediaStreamTrack.readyState === "ended"
    ) {
      delete owned.current.camera;
      setTracks({ ...owned.current });
    }
  }

  async function changeAudio(next: MicrophoneSettings) {
    if (locked.current || background.busy || audio.busy) return;
    const ticket = operation.current + (owned.current.microphone ? 1 : 0);
    await audio.change(
      next,
      async (settings) => {
        if (settings.filter !== "standard")
          throw new Error("Vào phòng để bật Krisp.");
        if (owned.current.microphone)
          await capture(
            "microphone",
            roomDevices.selected.microphone,
            settings,
            true,
          );
      },
      () => alive.current && operation.current === ticket,
    );
  }

  /** Ownership passes to the connection hook, including on cancellation/failure. */
  function takeTracks() {
    const result = Object.values(owned.current).filter(
      (track): track is LocalTrack => !!track,
    );
    owned.current = {};
    setTracks({});
    return result;
  }

  return {
    tracks,
    devices: roomDevices.devices,
    selected: roomDevices.selected,
    busy,
    changeBackground,
    changeAudio,
    error,
    toggle,
    select,
    takeTracks,
    stop,
  };
}
