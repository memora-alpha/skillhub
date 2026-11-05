export type NativeBackground =
  | { mode: "off" }
  | { mode: "blur" }
  | { mode: "image"; preset: "ocean" | "sunset" | "violet" };

export const nativeBackgroundChoices: Readonly<
  Record<string, NativeBackground>
> = {
  "Tắt hiệu ứng": { mode: "off" },
  "Mờ nền": { mode: "blur" },
  "Biển xanh": { mode: "image", preset: "ocean" },
  "Nắng ấm": { mode: "image", preset: "sunset" },
  "Tím dịu": { mode: "image", preset: "violet" },
};

export function nativeBackgroundLabel(settings: NativeBackground) {
  return (
    Object.keys(nativeBackgroundChoices).find((label) => {
      const choice = nativeBackgroundChoices[label]!;
      return (
        choice.mode === settings.mode &&
        (choice.mode !== "image" ||
          settings.mode !== "image" ||
          choice.preset === settings.preset)
      );
    }) ?? "Tắt hiệu ứng"
  );
}

export type NativeBackgroundStatus = {
  trackId: string;
  state: "ready" | "error";
  requestId: string;
};

export type NativeBackgroundBridge = {
  apiVersion: () => number;
  isSupported: () => boolean;
  configure: (
    trackId: string,
    mode: NativeBackground["mode"],
    preset: string | null,
    requestId: string,
  ) => Promise<void>;
  addListener: (
    event: "onStatus",
    listener: (status: NativeBackgroundStatus) => void,
  ) => { remove: () => void };
};
