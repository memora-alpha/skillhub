"use client";
import type { useRoomPreview } from "./use-room-preview";
import { RoomIcon } from "./room-icon";
import { RoomTrack } from "./room-track";
import { RoomMicrophoneMeter } from "./room-microphone-meter";
import type { RoomAudio } from "./use-room-audio";
import { RoomAvatar } from "./room-avatar";
import { RoomBackgroundControl } from "./room-background-control";
import type { CameraBackground } from "./use-camera-background";
import styles from "./room.module.css";

export function RoomPrejoin({
  name,
  avatarUrl,
  preview,
  background,
  audio,
  connecting,
  canJoin,
  onJoin,
  onCancel,
}: {
  name: string;
  avatarUrl?: string | null;
  preview: ReturnType<typeof useRoomPreview>;
  background: CameraBackground;
  audio: RoomAudio;
  connecting: boolean;
  canJoin: boolean;
  onJoin: () => void;
  onCancel: () => void;
}) {
  const camera = !!preview.tracks.camera;
  const microphone = !!preview.tracks.microphone;
  return (
    <div className={styles.prejoin}>
      <div className={styles.previewColumn}>
        <div className={styles.previewCamera}>
          {preview.tracks.camera ? (
            <RoomTrack
              track={preview.tracks.camera}
              local
              label="Xem trước camera của bạn"
              className={styles.previewMedia}
            />
          ) : (
            <div className={styles.previewPlaceholder}>
              <RoomAvatar
                name={name}
                avatarUrl={avatarUrl}
                className={styles.avatar}
              />
              <strong>Camera đang tắt</strong>
              <span>Bật camera để xem trước hình ảnh của bạn</span>
            </div>
          )}
          <span className={styles.previewName}>{name} (Bạn)</span>
          <div className={styles.previewControls}>
            <button
              type="button"
              className={styles.iconButton}
              data-tone={microphone ? undefined : "off"}
              title={microphone ? "Tắt micro" : "Bật micro"}
              aria-label={microphone ? "Tắt micro" : "Bật micro"}
              aria-pressed={microphone}
              disabled={
                preview.busy || background.busy || audio.busy || connecting
              }
              onClick={() => preview.toggle("microphone")}
            >
              <RoomIcon name={microphone ? "microphone" : "microphoneOff"} />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              data-tone={camera ? undefined : "off"}
              title={camera ? "Tắt camera" : "Bật camera"}
              aria-label={camera ? "Tắt camera" : "Bật camera"}
              aria-pressed={camera}
              disabled={
                preview.busy || background.busy || audio.busy || connecting
              }
              onClick={() => preview.toggle("camera")}
            >
              <RoomIcon name={camera ? "camera" : "cameraOff"} />
            </button>
          </div>
        </div>
        <div className={styles.deviceSelects}>
          {(
            [
              ["microphone", "audioinput", "Micro"],
              ["camera", "videoinput", "Camera"],
            ] as const
          ).map(([kind, deviceKind, label]) => (
            <label key={kind}>
              <RoomIcon name={kind} />
              <span>
                {label}
                <select
                  aria-label={`Chọn ${label.toLowerCase()}`}
                  value={preview.selected[kind]}
                  disabled={
                    preview.busy || background.busy || audio.busy || connecting
                  }
                  onChange={(event) => preview.select(kind, event.target.value)}
                >
                  <option value="">Thiết bị mặc định</option>
                  {preview.devices
                    .filter(
                      (device) =>
                        device.kind === deviceKind &&
                        device.deviceId &&
                        device.deviceId !== "default",
                    )
                    .map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `${label} ${index + 1}`}
                      </option>
                    ))}
                </select>
              </span>
            </label>
          ))}
        </div>
        <RoomBackgroundControl
          background={background}
          disabled={preview.busy || audio.busy || connecting}
          onToggle={() =>
            void preview.changeBackground(
              background.enabled
                ? { mode: "off" }
                : { mode: "blur", blurRadius: 12 },
            )
          }
        />
        <div className={styles.microphoneCheck}>
          <RoomIcon name={microphone ? "microphone" : "microphoneOff"} />
          <span>
            {microphone ? "Nói thử để kiểm tra micro" : "Micro đang tắt"}
          </span>
          <RoomMicrophoneMeter
            track={preview.tracks.microphone}
            audio={audio}
          />
        </div>
        {preview.busy && (
          <p className={styles.previewHint} role="status">
            Đang mở thiết bị… Nếu được hỏi, hãy chọn cho phép trong trình duyệt.
          </p>
        )}
        {preview.error && (
          <p className={styles.previewError} role="alert">
            {preview.error}
          </p>
        )}
      </div>
      <div className={styles.prejoinInfo}>
        <span className={styles.eyebrow}>TRƯỚC KHI BẮT ĐẦU</span>
        <h2>Sẵn sàng học cùng nhau?</h2>
        <p>
          Kiểm tra camera, micro và chọn thiết bị bạn muốn dùng cho buổi học.
        </p>
        <button
          type="button"
          className={styles.startButton}
          disabled={
            !canJoin ||
            preview.busy ||
            background.busy ||
            audio.busy ||
            connecting
          }
          onClick={onJoin}
        >
          <RoomIcon name="join" />
          {connecting ? "Đang vào phòng…" : "Bắt đầu học"}
        </button>
        {connecting && (
          <button
            type="button"
            className={styles.cancelJoin}
            onClick={onCancel}
          >
            Hủy kết nối
          </button>
        )}
        <p className={styles.previewHint}>
          Bạn có thể vào phòng với camera và micro tắt. Hình ảnh, âm thanh chỉ
          được chia sẻ sau khi bạn bấm “Bắt đầu học”.
        </p>
      </div>
    </div>
  );
}
