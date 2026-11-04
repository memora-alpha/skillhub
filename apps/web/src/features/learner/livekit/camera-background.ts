import type { LocalVideoTrack } from "livekit-client";
import type { BackgroundProcessorWrapper } from "@livekit/track-processors";
import type { BackgroundSettings } from "./media-settings";

type BackgroundModule = Pick<
  typeof import("@livekit/track-processors"),
  "BackgroundProcessor" | "supportsBackgroundProcessors"
>;
type LoadBackground = () => Promise<BackgroundModule>;
const loadBackground: LoadBackground = () =>
  import("@livekit/track-processors");
const processors = new WeakMap<LocalVideoTrack, BackgroundProcessorWrapper>();
const configurations = new WeakMap<LocalVideoTrack, string>();

export class BackgroundUnavailableError extends Error {}
export class BackgroundCancelledError extends Error {}

export async function checkCameraBackground(load = loadBackground) {
  const sdk = await load();
  if (!sdk.supportsBackgroundProcessors())
    throw new BackgroundUnavailableError();
  return sdk;
}

/** Process the camera before publishing; never use this for a screen-share track. */
export async function setCameraBackground(
  track: LocalVideoTrack,
  settings: BackgroundSettings | boolean,
  isCurrent: () => boolean,
  load: LoadBackground = loadBackground,
) {
  const options = backgroundOptions(settings);
  const key = JSON.stringify(options);
  const current = () =>
    isCurrent() && track.mediaStreamTrack.readyState !== "ended";
  const requireCurrent = () => {
    if (!current()) {
      track.stop();
      throw new BackgroundCancelledError();
    }
  };
  requireCurrent();
  let processor = processors.get(track);
  if (processor !== track.getProcessor()) processor = undefined;
  if (!processor && options.mode === "disabled") return;
  if (processor && configurations.get(track) === key) return;

  // Loading/support errors leave an already-running, unprocessed camera intact.
  const sdk = processor ? undefined : await checkCameraBackground(load);
  if (!current()) {
    track.stop();
    throw new BackgroundCancelledError();
  }
  const existing = !!processor;
  processor ??= sdk!.BackgroundProcessor(options);
  try {
    if (existing) await processor.switchTo(options);
    else await track.setProcessor(processor);
    if (!current()) throw new BackgroundCancelledError();
    processors.set(track, processor);
    configurations.set(track, key);
  } catch (cause) {
    // stop() destroys an attached processor. Failed/late initialization may not
    // have attached it yet, so that processor still needs explicit disposal.
    const attached = track.getProcessor() === processor;
    track.stop();
    if (!attached) await processor.destroy().catch(() => undefined);
    processors.delete(track);
    configurations.delete(track);
    throw cause;
  }
}

function backgroundOptions(settings: BackgroundSettings | boolean) {
  let next: BackgroundSettings =
    settings === true ? { mode: "blur", blurRadius: 12 } : { mode: "off" };
  if (typeof settings !== "boolean") next = settings;
  if (next.mode === "image")
    return { mode: "virtual-background" as const, imagePath: next.imagePath };
  if (next.mode === "blur")
    return {
      mode: "background-blur" as const,
      blurRadius: Math.max(1, Math.min(30, next.blurRadius)),
    };
  return { mode: "disabled" as const };
}
