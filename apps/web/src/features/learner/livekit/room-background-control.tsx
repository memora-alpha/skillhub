import type { CameraBackground } from "./use-camera-background";
import { RoomIcon } from "./room-icon";
import styles from "./room.module.css";

export function RoomBackgroundControl({
  background,
  disabled,
  onToggle,
}: {
  background: CameraBackground;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.backgroundButton}
      aria-pressed={background.enabled}
      aria-busy={background.busy}
      disabled={disabled || background.busy || background.unsupported}
      onClick={onToggle}
      title="Bật hoặc tắt hiệu ứng nền camera"
    >
      <RoomIcon name="background" />
      <span>
        {background.busy
          ? "Đang xử lý nền…"
          : background.enabled
            ? background.settings.mode === "image"
              ? "Ảnh nền: Bật"
              : "Mờ nền: Bật"
            : "Mờ nền: Tắt"}
      </span>
    </button>
  );
}
