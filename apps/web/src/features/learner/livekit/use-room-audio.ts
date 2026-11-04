"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalAudioTrack, Room } from "livekit-client";
import {
  defaultMicrophoneSettings,
  validMicrophoneSettings,
  type MicrophoneSettings,
} from "./media-settings";
import {
  MicrophoneCancelledError,
  MicrophoneEffectError,
  prepareMicrophone,
} from "./microphone-processor";

export function useRoomAudio() {
  const preference = useRef(defaultMicrophoneSettings);
  const context = useRef<AudioContext | undefined>(undefined);
  const lifetime = useRef({ active: false });
  const locked = useRef(false);
  const [settings, setSettings] = useState(defaultMicrophoneSettings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const current = { active: true };
    lifetime.current = current;
    const close = () => {
      const audio = context.current;
      context.current = undefined;
      if (audio && audio.state !== "closed")
        void audio.close().catch(() => undefined);
    };
    window.addEventListener("pagehide", close);
    return () => {
      current.active = false;
      window.removeEventListener("pagehide", close);
      close();
    };
  }, []);

  const getContext = useCallback(() => {
    if (typeof AudioContext === "undefined") return undefined;
    if (!context.current || context.current.state === "closed")
      context.current = new AudioContext();
    return context.current;
  }, []);
  const prepare = useCallback(
    async (
      track: LocalAudioTrack,
      isCurrent: () => boolean,
      room?: Room,
      next: MicrophoneSettings = preference.current,
    ) => {
      const effective =
        !room && next.filter !== "standard"
          ? { ...next, filter: "standard" as const }
          : next;
      if (effective.gain === 1 && effective.filter === "standard") return;
      const audio = getContext();
      if (!audio)
        throw new MicrophoneEffectError(
          "Trình duyệt chưa hỗ trợ xử lý âm thanh. Chọn lọc cơ bản và mức mic 100%.",
        );
      void audio.resume().catch(() => undefined);
      await prepareMicrophone(track, effective, audio, isCurrent, room);
    },
    [getContext],
  );

  async function change(
    next: MicrophoneSettings,
    apply: (settings: MicrophoneSettings) => Promise<void>,
    isCurrent: () => boolean,
  ) {
    if (locked.current || !validMicrophoneSettings(next)) return;
    const ticket = lifetime.current;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await apply(next);
      if (ticket.active && isCurrent()) {
        preference.current = next;
        setSettings(next);
      }
    } catch (cause) {
      if (
        ticket.active &&
        isCurrent() &&
        !(cause instanceof MicrophoneCancelledError)
      )
        setError(
          cause instanceof MicrophoneEffectError
            ? cause.message
            : "Chưa áp dụng được âm thanh. Kiểm tra quyền mic và kết nối; chọn lọc cơ bản rồi bật lại mic để thử lại.",
        );
    } finally {
      locked.current = false;
      if (ticket.active) setBusy(false);
    }
  }
  return { settings, busy, error, prepare, change, getContext };
}
export type RoomAudio = ReturnType<typeof useRoomAudio>;
