import type { AudioCaptureOptions } from "livekit-client";

export type BackgroundSettings =
  | { mode: "off" }
  | { mode: "blur"; blurRadius: number }
  | { mode: "image"; imagePath: string };

export const backgroundPresets = [
  { name: "Đồi xanh", imagePath: "/room-backgrounds/hills.svg" },
  { name: "Bình minh", imagePath: "/room-backgrounds/sunrise.svg" },
  { name: "Không gian tím", imagePath: "/room-backgrounds/violet.svg" },
] as const;

export type MicrophoneSettings = {
  gain: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  filter: "standard" | "krisp" | "voice-isolation";
};
export const defaultMicrophoneSettings: MicrophoneSettings = {
  gain: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  filter: "standard",
};

export function microphoneCaptureOptions(
  settings: MicrophoneSettings,
  deviceId = "",
): AudioCaptureOptions {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    echoCancellation: settings.echoCancellation,
    noiseSuppression: settings.noiseSuppression,
    autoGainControl: settings.autoGainControl,
  };
}

export function validMicrophoneSettings(settings: MicrophoneSettings) {
  return (
    Number.isFinite(settings.gain) &&
    settings.gain >= 0 &&
    settings.gain <= 2 &&
    ["standard", "krisp", "voice-isolation"].includes(settings.filter)
  );
}

/** Private local image: no upload to SkillHub or third-party storage. */
export async function localBackgroundImage(file: File): Promise<string> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size === 0 ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      image.naturalWidth * image.naturalHeight > 16_000_000
    )
      throw new Error(
        "Ảnh quá lớn. Chọn ảnh có độ phân giải tối đa 16 megapixel.",
      );
    return url;
  } catch (cause) {
    URL.revokeObjectURL(url);
    throw cause instanceof Error && cause.message.includes("megapixel")
      ? cause
      : new Error("Không đọc được ảnh. Hãy chọn ảnh JPG, PNG hoặc WebP khác.");
  }
}
