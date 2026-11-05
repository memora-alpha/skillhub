import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  Track,
  type LocalVideoTrack,
  type Room,
} from "livekit-client";
import { nativeBackgroundModule } from "../utils/native-background-module";
import {
  publishNativeCamera,
  changePublishedCameraBackground,
} from "../utils/publish-native-camera";
import type { NativeBackground } from "../utils/native-background";

type CameraOwner = {
  room: Room;
  track: LocalVideoTrack;
  requestId: string;
  failed: boolean;
};

export function useNativeCameraBackground(isCurrent: () => boolean) {
  const [bridge] = useState(nativeBackgroundModule);
  const [settings, setSettings] = useState<NativeBackground>({ mode: "off" });
  const [busy, setBusy] = useState(false);
  const [warming, setWarming] = useState(false);
  const [error, setError] = useState("");
  const owner = useRef<CameraOwner | null>(null);
  const mounted = useRef(true);
  const flight = useRef(false);
  const request = useRef(0);
  const facing = useRef<"user" | "environment">("user");
  const latest = useRef({ settings, isCurrent });
  latest.current = { settings, isCurrent };
  const releaseTrack = useCallback(
    async (track: LocalVideoTrack) => {
      track.stop();
      if (owner.current?.track === track) owner.current = null;
      await bridge?.configure(
        track.mediaStreamTrack.id,
        "off",
        null,
        String(++request.current),
      );
    },
    [bridge],
  );
  useEffect(() => {
    mounted.current = true;
    const subscription = bridge?.addListener("onStatus", (event) => {
      const target = owner.current;
      if (
        !mounted.current ||
        !latest.current.isCurrent() ||
        !target ||
        event.trackId !== target.track.mediaStreamTrack.id ||
        event.requestId !== target.requestId
      )
        return;
      setWarming(false);
      if (event.state === "error") {
        target.failed = true;
        target.track.stop();
        setError(
          "Không xử lý được nền camera. Camera đã được tắt; hãy chọn lại hiệu ứng rồi bật camera.",
        );
        void target.room.localParticipant
          .unpublishTrack(target.track)
          .finally(() => releaseTrack(target.track))
          .catch(() => {});
      }
    });
    return () => {
      mounted.current = false;
      subscription?.remove();
      const target = owner.current;
      if (target) void releaseTrack(target.track).catch(() => {});
    };
  }, [bridge, releaseTrack]);

  const publish = useCallback(
    async (room: Room, active: () => boolean, nextFacing = facing.current) => {
      if (flight.current) throw new Error("CAMERA_CHANGE_PENDING");
      flight.current = true;
      setBusy(true);
      setError("");
      let candidate: CameraOwner | null = null;
      const current = () =>
        mounted.current &&
        latest.current.isCurrent() &&
        active() &&
        room.state === ConnectionState.Connected &&
        !candidate?.failed;
      try {
        const old = room.localParticipant.getTrackPublication(
          Track.Source.Camera,
        )?.track;
        if (old) {
          await room.localParticipant.unpublishTrack(old);
          await releaseTrack(old as LocalVideoTrack);
        }
        if (!current()) throw new Error("CAMERA_ATTEMPT_RETIRED");
        const selected = latest.current.settings;
        const publication = await publishNativeCamera(
          room,
          {
            ...room.options.videoCaptureDefaults,
            facingMode: nextFacing,
          },
          async (track) => {
            candidate = {
              room,
              track,
              requestId: String(++request.current),
              failed: false,
            };
            owner.current = candidate;
            if (selected.mode !== "off") {
              if (!bridge) throw new Error("BACKGROUND_REBUILD_REQUIRED");
              setWarming(true);
              await bridge.configure(
                track.mediaStreamTrack.id,
                selected.mode,
                selected.mode === "image" ? selected.preset : null,
                candidate.requestId,
              );
            }
          },
          releaseTrack,
          current,
        );
        if (current()) facing.current = nextFacing;
        return publication;
      } catch (cause) {
        if (mounted.current && latest.current.isCurrent()) {
          setWarming(false);
          setError(
            "Chưa bật được camera với cài đặt đã chọn. Kiểm tra quyền hoặc chọn lại hiệu ứng.",
          );
        }
        throw cause;
      } finally {
        flight.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [bridge, releaseTrack],
  );

  const release = useCallback(
    async (room: Room) => {
      const target = owner.current;
      if (target?.room === room) await releaseTrack(target.track);
      if (mounted.current) setWarming(false);
    },
    [releaseTrack],
  );

  async function change(next: NativeBackground) {
    if (flight.current || !mounted.current || !latest.current.isCurrent())
      return;
    if (!bridge && next.mode !== "off") return;
    flight.current = true;
    setBusy(true);
    setError("");
    const target = owner.current;
    try {
      if (
        target &&
        target.room.state === ConnectionState.Connected &&
        !target.failed
      ) {
        target.requestId = String(++request.current);
        setWarming(next.mode !== "off");
        const changed = await changePublishedCameraBackground(
          target.track,
          async () => {
            await bridge?.configure(
              target.track.mediaStreamTrack.id,
              next.mode,
              next.mode === "image" ? next.preset : null,
              target.requestId,
            );
          },
          () =>
            mounted.current &&
            latest.current.isCurrent() &&
            target === owner.current &&
            !target.failed &&
            target.room.state === ConnectionState.Connected,
        );
        if (!changed) return;
      }
      if (!mounted.current || !latest.current.isCurrent()) return;
      latest.current.settings = next;
      setSettings(next);
      if (next.mode === "off" || !target) setWarming(false);
    } catch {
      if (target) {
        target.track.stop();
        await target.room.localParticipant
          .unpublishTrack(target.track)
          .catch(() => {});
        await releaseTrack(target.track).catch(() => {});
      }
      if (mounted.current && latest.current.isCurrent()) {
        setWarming(false);
        setError(
          "Chưa áp dụng được hiệu ứng nền. Camera đã tắt để tránh gửi hình chưa xử lý.",
        );
      }
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return {
    available: !!bridge,
    settings,
    busy,
    warming,
    error,
    publish,
    release,
    change,
  };
}
