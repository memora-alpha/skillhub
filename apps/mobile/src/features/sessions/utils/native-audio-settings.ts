export type NativeAudioSettings = {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  microphoneGain: number;
};

export const defaultNativeAudioSettings: NativeAudioSettings = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  microphoneGain: 1,
};

export function nativeAudioCapture(settings: NativeAudioSettings) {
  return {
    echoCancellation: settings.echoCancellation,
    noiseSuppression: settings.noiseSuppression,
    autoGainControl: settings.autoGainControl,
  };
}

type NativeAudioTrack = {
  kind: string;
  remote?: boolean;
  _setVolume?: (gain: number) => void;
};

// The iOS bridge writes RTCAudioSource.volume. Android's AudioTrack.setVolume
// adjusts playout, so it must not be presented as microphone capture gain.
export function setNativeMicrophoneGain(
  track: NativeAudioTrack,
  gain: number,
  platform: string,
) {
  if (
    platform !== "ios" ||
    track.kind !== "audio" ||
    track.remote ||
    typeof track._setVolume !== "function"
  )
    return false;
  if (!Number.isFinite(gain) || gain < 0 || gain > 2)
    throw new Error("INVALID_MICROPHONE_GAIN");
  track._setVolume(gain);
  return true;
}

type MicrophoneTrack = {
  mediaStreamTrack: NativeAudioTrack;
  restartTrack: (
    capture: ReturnType<typeof nativeAudioCapture>,
  ) => Promise<void>;
  mute: () => Promise<unknown>;
  stop: () => void;
};

export async function configureNativeMicrophone(
  track: MicrophoneTrack | undefined,
  previous: NativeAudioSettings,
  next: NativeAudioSettings,
  platform: string,
  current: () => boolean,
) {
  if (!current()) return false;
  if (!track) return true;
  const capture = nativeAudioCapture(next);
  const changed =
    previous.echoCancellation !== next.echoCancellation ||
    previous.noiseSuppression !== next.noiseSuppression ||
    previous.autoGainControl !== next.autoGainControl;
  try {
    if (changed) await track.restartTrack(capture);
    if (!current()) {
      track.stop();
      return false;
    }
    setNativeMicrophoneGain(
      track.mediaStreamTrack,
      next.autoGainControl ? 1 : next.microphoneGain,
      platform,
    );
    return true;
  } catch (cause) {
    await track.mute().catch(() => {});
    throw cause;
  }
}

export const audioOutputLabels: Readonly<Record<string, string>> = {
  speaker: "Loa ngoài",
  earpiece: "Loa trong",
  headset: "Tai nghe",
  bluetooth: "Bluetooth",
  default: "Tự động",
  force_speaker: "Loa ngoài",
};
