"use client";
import { useEffect, useRef, useState } from "react";
import type { Track } from "livekit-client";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import styles from "./room-track.module.css";

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
  const [readyTrack, setReadyTrack] = useState<Track>();
  const ready = readyTrack === track;
  useEffect(() => {
    const element = track.attach();
    let active = true;
    const showMedia = () => {
      if (active) setReadyTrack(track);
    };
    const showPlaceholder = () => {
      if (active) setReadyTrack(undefined);
    };
    element.addEventListener("loadeddata", showMedia);
    element.addEventListener("playing", showMedia);
    element.addEventListener("waiting", showPlaceholder);
    const frame = requestAnimationFrame(() => {
      if (element.readyState >= 2) showMedia();
    });
    element.autoplay = true;
    element.muted = local;
    element.setAttribute("aria-label", label);
    if (element instanceof HTMLVideoElement) element.playsInline = true;
    container.current?.appendChild(element);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      element.removeEventListener("loadeddata", showMedia);
      element.removeEventListener("playing", showMedia);
      element.removeEventListener("waiting", showPlaceholder);
      track.detach(element);
      element.remove();
    };
  }, [track, local, label]);
  return (
    <div
      ref={container}
      className={`${className ?? ""} ${styles.track}`}
      aria-busy={!ready || undefined}
    >
      {!ready && (
        <div className={styles.placeholder}>
          <LoadingSkeleton
            variant="image"
            label={"Đang tải " + label.toLocaleLowerCase("vi")}
          />
        </div>
      )}
    </div>
  );
}
