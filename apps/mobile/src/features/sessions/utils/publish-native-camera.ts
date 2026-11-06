import {
  createLocalVideoTrack,
  Track,
  type LocalVideoTrack,
  type Room,
  type VideoCaptureOptions,
} from "livekit-client";

/** Keep an already published camera paused until its new effect is installed. */
export async function changePublishedCameraBackground(
  track: LocalVideoTrack,
  apply: () => Promise<void>,
  current: () => boolean,
) {
  try {
    await track.pauseUpstream();
    if (!current()) {
      track.stop();
      return false;
    }
    await apply();
    if (!current()) {
      track.stop();
      return false;
    }
    await track.resumeUpstream();
    if (!current()) {
      track.stop();
      return false;
    }
    return true;
  } catch (cause) {
    track.stop();
    throw cause;
  }
}

/** Attach the native effect before the camera can be published to the peer. */
export async function publishNativeCamera(
  room: Room,
  options: VideoCaptureOptions,
  prepare: (track: LocalVideoTrack) => Promise<void>,
  release: (track: LocalVideoTrack) => Promise<void>,
  current: () => boolean,
  create = createLocalVideoTrack,
) {
  const track = await create(options);
  track.source = Track.Source.Camera;
  try {
    if (!current()) throw new Error("CAMERA_ATTEMPT_RETIRED");
    await prepare(track);
    if (!current()) throw new Error("CAMERA_ATTEMPT_RETIRED");
    const publication = await room.localParticipant.publishTrack(track, {
      source: Track.Source.Camera,
    });
    if (!current()) throw new Error("CAMERA_ATTEMPT_RETIRED");
    return publication;
  } catch (cause) {
    track.stop();
    await room.localParticipant.unpublishTrack(track).catch(() => {});
    await release(track).catch(() => {});
    throw cause;
  }
}
