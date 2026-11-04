import type {
  AudioProcessorOptions,
  Room,
  Track,
  TrackProcessor,
  LocalAudioTrack,
} from "livekit-client";
import type { KrispNoiseFilterProcessor } from "@livekit/krisp-noise-filter";
import type { GainAudioProcessor } from "@livekit/track-processors";
import type { MicrophoneSettings } from "./media-settings";

export class MicrophoneEffectError extends Error {}
export class MicrophoneCancelledError extends Error {}

/** SDK tracks accept one processor: noise filtering must feed the gain stage. */
export class MicrophoneProcessor implements TrackProcessor<
  Track.Kind.Audio,
  AudioProcessorOptions
> {
  name = "skillhub-microphone";
  processedTrack?: MediaStreamTrack;
  private generation = 0;
  private noise?: KrispNoiseFilterProcessor;
  constructor(
    private gain: GainAudioProcessor,
    private noiseFactory?: () => KrispNoiseFilterProcessor,
    private room?: Room,
  ) {}

  async init(options: AudioProcessorOptions) {
    const ticket = ++this.generation;
    const noise = (this.noise = this.noiseFactory?.());
    try {
      if (noise) {
        await noise.init(options);
        if (ticket !== this.generation) throw new MicrophoneCancelledError();
        if (!this.room)
          throw new MicrophoneEffectError("Vào phòng để bật Krisp.");
        await noise.onPublish(this.room);
        await noise.setEnabled(true);
        if (!noise.isEnabled())
          throw new MicrophoneEffectError(
            "Môi trường LiveKit hiện tại chưa cho phép bật Krisp. Chọn lọc cơ bản để tiếp tục dùng mic.",
          );
      }
      if (ticket !== this.generation) throw new MicrophoneCancelledError();
      await this.gain.init({
        ...options,
        track: noise?.processedTrack ?? options.track,
      });
      if (ticket !== this.generation) throw new MicrophoneCancelledError();
      this.processedTrack = this.gain.processedTrack;
    } catch (cause) {
      await Promise.allSettled([this.gain.destroy(), noise?.destroy()]);
      if (this.noise === noise) this.noise = undefined;
      throw cause;
    }
  }

  async restart(options: AudioProcessorOptions) {
    await this.destroy();
    await this.init(options);
  }
  async destroy() {
    this.generation++;
    this.processedTrack = undefined;
    const noise = this.noise;
    this.noise = undefined;
    await Promise.allSettled([this.gain.destroy(), noise?.destroy()]);
  }
}

export async function createMicrophoneProcessor(
  settings: MicrophoneSettings,
  room?: Room,
) {
  const { GainAudioProcessor } = await import("@livekit/track-processors");
  if (!GainAudioProcessor.isSupported)
    throw new MicrophoneEffectError(
      "Trình duyệt chưa hỗ trợ chỉnh âm lượng mic. Thử Chrome hoặc Edge bản mới.",
    );
  let noiseFactory: (() => KrispNoiseFilterProcessor) | undefined;
  if (settings.filter !== "standard") {
    if (!room || room.state !== "connected")
      throw new MicrophoneEffectError(
        "Vào phòng để kiểm tra và bật Krisp. Lọc cơ bản vẫn dùng được ở màn xem trước.",
      );
    const sdk = await import("@livekit/krisp-noise-filter");
    if (!sdk.isKrispNoiseFilterSupported())
      throw new MicrophoneEffectError(
        "Trình duyệt này chưa hỗ trợ Krisp. Chọn lọc cơ bản hoặc thử trình duyệt mới hơn.",
      );
    noiseFactory = () =>
      sdk.KrispNoiseFilter({
        useBVC: settings.filter === "voice-isolation",
        debugLogs: false,
      });
  }
  return new MicrophoneProcessor(
    new GainAudioProcessor({ gainValue: settings.gain }),
    noiseFactory,
    room,
  );
}

export async function prepareMicrophone(
  track: LocalAudioTrack,
  settings: MicrophoneSettings,
  context: AudioContext,
  isCurrent: () => boolean,
  room?: Room,
  create = createMicrophoneProcessor,
) {
  const current = () =>
    isCurrent() && track.mediaStreamTrack.readyState !== "ended";
  if (!current()) {
    track.stop();
    throw new MicrophoneCancelledError();
  }
  // Default capture needs no Web Audio processing; native WebRTC filters apply.
  if (settings.gain === 1 && settings.filter === "standard") return;
  const processor = await create(settings, room);
  try {
    if (!current()) throw new MicrophoneCancelledError();
    await track.setAudioContext(context);
    if (!current()) throw new MicrophoneCancelledError();
    await track.setProcessor(processor);
    if (!current()) throw new MicrophoneCancelledError();
  } catch (cause) {
    const attached = track.getProcessor() === processor;
    track.stop();
    if (!attached) await processor.destroy().catch(() => undefined);
    throw cause;
  }
}
