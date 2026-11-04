"use client";
import { useEffect, useRef } from "react";
import type { LocalTrack } from "livekit-client";
import type { RoomAudio } from "./use-room-audio";

export function RoomMicrophoneMeter({
  track,
  audio,
}: {
  track?: LocalTrack;
  audio: RoomAudio;
}) {
  const meter = useRef<HTMLMeterElement>(null);
  const { getContext } = audio;
  useEffect(() => {
    if (!track || track.mediaStreamTrack.readyState === "ended") return;
    const context = getContext();
    if (!context) return;
    const source = context.createMediaStreamSource(
      new MediaStream([track.mediaStreamTrack]),
    );
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const element = meter.current;
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      const level =
        Math.sqrt(
          data.reduce((sum, value) => sum + (value - 128) ** 2, 0) /
            data.length,
        ) / 128;
      if (element) element.value = Math.min(1, level * 4);
    }, 100);
    void context.resume().catch(() => undefined);
    return () => {
      clearInterval(timer);
      source.disconnect();
      analyser.disconnect();
      if (element) element.value = 0;
    };
  }, [track, getContext]);
  return (
    <meter
      ref={meter}
      min={0}
      max={1}
      value={0}
      aria-label="Mức âm thanh mic sau xử lý"
    />
  );
}
