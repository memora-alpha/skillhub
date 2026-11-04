"use client";
import { useId, useRef, useState } from "react";
import type { LocalTrack, Track } from "livekit-client";
import type { CameraBackground } from "./use-camera-background";
import type { RoomAudio } from "./use-room-audio";
import type { DeviceKind, RoomDevices } from "./use-room-devices";
import {
  backgroundPresets,
  type BackgroundSettings,
  type MicrophoneSettings,
} from "./media-settings";
import { RoomIcon } from "./room-icon";
import { RoomTrack } from "./room-track";
import { RoomMicrophoneMeter } from "./room-microphone-meter";
import styles from "./room-media-settings.module.css";

type SettingsProps = {
  background: CameraBackground;
  audio: RoomAudio;
  devices: RoomDevices;
  cameraTrack?: Track;
  microphoneTrack?: LocalTrack;
  microphone: boolean;
  connected: boolean;
  disabled: boolean;
  changeBackground: (settings: BackgroundSettings) => Promise<unknown>;
  changeAudio: (settings: MicrophoneSettings) => Promise<unknown>;
  selectDevice: (kind: DeviceKind, id: string) => void;
  toggleMicrophone: () => void;
};

function AudioForm({
  audio,
  connected,
  disabled,
  apply,
}: {
  audio: RoomAudio;
  connected: boolean;
  disabled: boolean;
  apply: SettingsProps["changeAudio"];
}) {
  const [draft, setDraft] = useState(audio.settings);
  const supported =
    typeof navigator === "undefined"
      ? {}
      : (navigator.mediaDevices?.getSupportedConstraints() ?? {});
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void apply(draft);
      }}
    >
      <fieldset disabled={disabled}>
        <legend>Chất lượng âm thanh</legend>
        <label>
          Mức thu mic: {Math.round(draft.gain * 100)}%
          <input
            type="range"
            min="0"
            max="200"
            step="5"
            value={Math.round(draft.gain * 100)}
            onChange={(event) =>
              setDraft({ ...draft, gain: Number(event.target.value) / 100 })
            }
          />
        </label>
        <small>100% là mức gốc. Tăng quá cao có thể làm giọng bị rè.</small>
        {(
          [
            ["echoCancellation", "Chống vọng tiếng"],
            ["noiseSuppression", "Lọc tiếng ồn cơ bản"],
            ["autoGainControl", "Tự cân bằng độ lớn mic"],
          ] as const
        ).map(([key, label]) => (
          <label className={styles.check} key={key}>
            <input
              type="checkbox"
              checked={draft[key]}
              disabled={
                !supported[key] ||
                (key === "noiseSuppression" && draft.filter !== "standard")
              }
              onChange={(event) =>
                setDraft({ ...draft, [key]: event.target.checked })
              }
            />
            {label}
            {!supported[key] && <small>Trình duyệt chưa hỗ trợ</small>}
          </label>
        ))}
        {draft.filter !== "standard" && (
          <small>Krisp sẽ xử lý tiếng ồn thay cho bộ lọc cơ bản.</small>
        )}
        <label>
          Bộ lọc nâng cao
          <select
            value={draft.filter}
            onChange={(event) =>
              setDraft({
                ...draft,
                filter: event.target.value as MicrophoneSettings["filter"],
              })
            }
          >
            <option value="standard">Dùng lọc cơ bản</option>
            <option value="krisp" disabled={!connected}>
              Krisp — giảm tiếng ồn
            </option>
            <option value="voice-isolation" disabled={!connected}>
              Krisp — giảm giọng người phía sau
            </option>
          </select>
        </label>
        <small>
          {connected
            ? "Krisp cần trình duyệt và môi trường LiveKit hỗ trợ. Lần đầu có thể mất thời gian tải bộ lọc."
            : "Vào phòng để kiểm tra và bật Krisp. Bạn có thể kiểm tra mic với lọc cơ bản tại đây."}
        </small>
        <button type="submit">
          {audio.busy ? "Đang áp dụng…" : "Áp dụng âm thanh"}
        </button>
      </fieldset>
    </form>
  );
}

export function RoomMediaSettings(props: SettingsProps) {
  const { background, audio, devices, disabled, connected } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [radius, setRadius] = useState(12);
  const busy = disabled || background.busy || audio.busy;
  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
      >
        <RoomIcon name="settings" /> Hình nền & âm thanh
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={id}
        onClose={() => setOpen(false)}
      >
        <header>
          <h2 id={id}>Hình nền & âm thanh</h2>
          <button
            type="button"
            aria-label="Đóng cài đặt"
            onClick={() => dialog.current?.close()}
          >
            <RoomIcon name="close" />
          </button>
        </header>
        <div className={styles.columns}>
          <section aria-label="Hình nền camera">
            <div className={styles.preview}>
              {open && props.cameraTrack ? (
                <RoomTrack
                  track={props.cameraTrack}
                  local
                  label="Xem trước hiệu ứng camera"
                />
              ) : (
                <span>Bật camera để xem hiệu ứng nền</span>
              )}
            </div>
            <p>
              Hình nền đã chọn:{" "}
              {background.settings.mode === "off"
                ? "Không hiệu ứng"
                : background.settings.mode === "blur"
                  ? `Mờ nền (${background.settings.blurRadius})`
                  : "Ảnh nền"}
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                disabled={busy}
                aria-pressed={background.settings.mode === "off"}
                onClick={() => void props.changeBackground({ mode: "off" })}
              >
                Không hiệu ứng
              </button>
              <button
                type="button"
                disabled={busy || background.unsupported}
                aria-pressed={background.settings.mode === "blur"}
                onClick={() =>
                  void props.changeBackground({
                    mode: "blur",
                    blurRadius: radius,
                  })
                }
              >
                Làm mờ nền
              </button>
            </div>
            <label>
              Độ mờ: {radius}
              <input
                type="range"
                min="1"
                max="30"
                value={radius}
                disabled={busy}
                onChange={(event) => setRadius(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              disabled={busy || background.unsupported}
              onClick={() =>
                void props.changeBackground({
                  mode: "blur",
                  blurRadius: radius,
                })
              }
            >
              Áp dụng độ mờ
            </button>
            <div className={styles.presets}>
              {backgroundPresets.map((preset) => (
                <button
                  type="button"
                  key={preset.imagePath}
                  disabled={busy || background.unsupported}
                  aria-pressed={
                    background.settings.mode === "image" &&
                    background.settings.imagePath === preset.imagePath
                  }
                  onClick={() =>
                    void props.changeBackground({
                      mode: "image",
                      imagePath: preset.imagePath,
                    })
                  }
                >
                  <span
                    style={{ backgroundImage: `url("${preset.imagePath}")` }}
                  />
                  {preset.name}
                </button>
              ))}
            </div>
            <label>
              Chọn ảnh từ máy
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy || background.unsupported}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file)
                    void background.upload(file, props.changeBackground);
                }}
              />
            </label>
            <small>
              JPG, PNG, WebP tối đa 5 MB. Ảnh chỉ được xử lý trên thiết bị,
              không tải lên kho ảnh của SkillHub.
            </small>
          </section>
          <section aria-label="Thiết bị và micro">
            {(
              [
                ["camera", "videoinput", "Camera"],
                ["microphone", "audioinput", "Micro"],
              ] as const
            ).map(([kind, deviceKind, label]) => (
              <label key={kind}>
                {label}
                <select
                  value={devices.selected[kind]}
                  disabled={busy}
                  onChange={(event) =>
                    props.selectDevice(kind, event.target.value)
                  }
                >
                  <option value="">Thiết bị mặc định</option>
                  {devices.devices
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
              </label>
            ))}
            <div className={styles.meter}>
              <button
                type="button"
                disabled={busy}
                onClick={props.toggleMicrophone}
              >
                {props.microphone ? "Tắt mic" : "Bật mic để kiểm tra"}
              </button>
              {open && (
                <RoomMicrophoneMeter
                  track={props.microphone ? props.microphoneTrack : undefined}
                  audio={audio}
                />
              )}
              <small>
                {props.microphone
                  ? connected
                    ? "Nói thử để xem mức thu. Mic đang được gửi vào phòng."
                    : "Nói thử để xem mức thu; chưa gửi vào phòng."
                  : "Micro đang tắt."}
              </small>
            </div>
            {open && (
              <AudioForm
                key={JSON.stringify(audio.settings)}
                audio={audio}
                connected={connected}
                disabled={busy}
                apply={props.changeAudio}
              />
            )}
            <p>
              Cấu hình mic đã chọn: {Math.round(audio.settings.gain * 100)}% ·{" "}
              {audio.settings.filter === "standard"
                ? "Lọc cơ bản"
                : audio.settings.filter === "krisp"
                  ? "Krisp"
                  : "Krisp giảm giọng nền"}
            </p>
            {!props.microphone && (
              <small>Cấu hình âm thanh sẽ áp dụng khi bạn bật mic.</small>
            )}
          </section>
        </div>
        {(background.busy || audio.busy) && (
          <p role="status">Đang chuẩn bị hiệu ứng…</p>
        )}
        {background.error && <p role="alert">{background.error}</p>}
        {audio.error && <p role="alert">{audio.error}</p>}
      </dialog>
    </>
  );
}
