"use client";
import { useEffect, useRef } from "react";
import type { Track } from "livekit-client";

/** Keep the same media element attached when its tile changes size or is pinned. */
export function RoomTrack({
  track,
  local = false,
  label,
  className,
}: Readonly<{
  track: Track;
  local?: boolean;
  label: string;
  className?: string;
}>) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = track.attach();
    element.autoplay = true;
    element.muted = local;
    element.setAttribute("aria-label", label);
    if (element instanceof HTMLVideoElement) element.playsInline = true;
    container.current?.appendChild(element);
    return () => {
      track.detach(element);
      element.remove();
    };
  }, [track, local, label]);
  return <div ref={container} className={className} />;
}
