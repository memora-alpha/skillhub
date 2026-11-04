"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalVideoTrack } from "livekit-client";
import {
  BackgroundCancelledError,
  BackgroundUnavailableError,
  checkCameraBackground,
  setCameraBackground,
} from "./camera-background";
import {
  localBackgroundImage,
  type BackgroundSettings,
} from "./media-settings";

export function useCameraBackground() {
  const preference = useRef<BackgroundSettings>({ mode: "off" });
  const locked = useRef(false);
  const uploadLock = useRef(false);
  const lifetime = useRef({ active: false });
  const ownedImages = useRef(new Set<string>());
  const [settings, setSettings] = useState<BackgroundSettings>({ mode: "off" });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const current = { active: true };
    const images = ownedImages.current;
    lifetime.current = current;
    return () => {
      current.active = false;
      for (const url of images) URL.revokeObjectURL(url);
      images.clear();
    };
  }, []);

  const prepare = useCallback(
    (track: LocalVideoTrack, isCurrent: () => boolean) =>
      setCameraBackground(track, preference.current, isCurrent),
    [],
  );

  async function change(
    next: BackgroundSettings,
    track: LocalVideoTrack | undefined,
    isCurrent: () => boolean,
  ) {
    if (locked.current) return false;
    locked.current = true;
    const ticket = lifetime.current;
    const active = () => ticket.active && isCurrent();
    setBusy(true);
    setError(undefined);
    try {
      if (track) await setCameraBackground(track, next, active);
      else if (next.mode !== "off") await checkCameraBackground();
      if (!active()) return false;
      preference.current = next;
      setSettings(next);
      setUnsupported(false);
      for (const url of ownedImages.current) {
        if (next.mode !== "image" || next.imagePath !== url) {
          URL.revokeObjectURL(url);
          ownedImages.current.delete(url);
        }
      }
      return true;
    } catch (cause) {
      if (!active() || cause instanceof BackgroundCancelledError) return false;
      setUnsupported(cause instanceof BackgroundUnavailableError);
      setError(
        cause instanceof BackgroundUnavailableError
          ? "Trình duyệt này chưa hỗ trợ hiệu ứng nền. Thử Chrome hoặc Edge bản mới."
          : "Chưa áp dụng được hiệu ứng nền. Kiểm tra mạng rồi thử lại; bật lại camera nếu camera đã tắt.",
      );
      return false;
    } finally {
      locked.current = false;
      if (ticket.active) setBusy(false);
    }
  }

  async function upload(
    file: File,
    apply: (settings: BackgroundSettings) => Promise<unknown>,
  ) {
    if (locked.current || uploadLock.current) return;
    uploadLock.current = true;
    setUploading(true);
    const ticket = lifetime.current;
    let url: string | undefined;
    try {
      url = await localBackgroundImage(file);
      if (!ticket.active) return;
      ownedImages.current.add(url);
      await apply({ mode: "image", imagePath: url });
    } catch (cause) {
      if (ticket.active)
        setError(
          cause instanceof Error ? cause.message : "Không đọc được ảnh nền.",
        );
    } finally {
      uploadLock.current = false;
      if (ticket.active) setUploading(false);
      if (
        url &&
        (preference.current.mode !== "image" ||
          preference.current.imagePath !== url)
      ) {
        ownedImages.current.delete(url);
        URL.revokeObjectURL(url);
      }
    }
  }

  return {
    settings,
    enabled: settings.mode !== "off",
    busy: busy || uploading,
    unsupported,
    error,
    prepare,
    change,
    upload,
    toggle: (track: LocalVideoTrack | undefined, isCurrent: () => boolean) =>
      change(
        preference.current.mode === "off"
          ? { mode: "blur", blurRadius: 12 }
          : { mode: "off" },
        track,
        isCurrent,
      ),
  };
}
export type CameraBackground = ReturnType<typeof useCameraBackground>;
