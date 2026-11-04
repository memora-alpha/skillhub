import type { CameraBackground } from "./use-camera-background";
import { RoomIcon } from "./room-icon";
import styles from "./room.module.css";

export function RoomBackgroundControl({
  background,
  disabled,
  onToggle,
}: Readonly<{
  background: CameraBackground;
  disabled: boolean;
  onToggle: () => void;
}>) {
  let label = "Mờ nền: Tắt";
  if (background.busy) label = "Đang xử lý nền…";
  else if (background.enabled)
    label =
      background.settings.mode === "image" ? "Ảnh nền: Bật" : "Mờ nền: Bật";
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
      <span>{label}</span>
    </button>
  );
}
