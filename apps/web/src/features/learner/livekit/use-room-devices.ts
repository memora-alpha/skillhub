"use client";
import { useCallback, useEffect, useState, useRef } from "react";

export type DeviceKind = "camera" | "microphone";
export function useRoomDevices() {
  const lifetime = useRef({ active: false });
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState({ camera: "", microphone: "" });
  const refresh = useCallback(async () => {
    try {
      return (await navigator.mediaDevices?.enumerateDevices()) ?? [];
    } catch {
      return [];
    }
  }, []);
  useEffect(() => {
    const current = { active: true };
    lifetime.current = current;
    let active = true;
    const update = () => {
      void refresh().then((value) => {
        if (active) setDevices(value);
      });
    };
    update();
    navigator.mediaDevices?.addEventListener("devicechange", update);
    return () => {
      active = false;
      current.active = false;
      navigator.mediaDevices?.removeEventListener("devicechange", update);
    };
  }, [refresh]);
  return {
    devices,
    selected,
    select: (kind: DeviceKind, deviceId: string) =>
      setSelected((value) => ({ ...value, [kind]: deviceId })),
    refresh: async () => {
      const current = lifetime.current;
      const value = await refresh();
      if (current.active) setDevices(value);
    },
  };
}
export type RoomDevices = ReturnType<typeof useRoomDevices>;
