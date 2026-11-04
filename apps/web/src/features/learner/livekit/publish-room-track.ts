import type { LocalTrack, Room } from "livekit-client";
import { MicrophoneCancelledError } from "./microphone-processor";

/** Krisp needs an assigned track SID. Keep the mic muted until verification. */
export async function publishRoomTrack(
  room: Room,
  track: LocalTrack,
  isCurrent: () => boolean,
  prepareEnhancedMicrophone?: () => Promise<void>,
) {
  const check = () => {
    if (!isCurrent()) throw new MicrophoneCancelledError();
  };
  try {
    check();
    if (prepareEnhancedMicrophone) await track.mute();
    check();
    const publication = await room.localParticipant.publishTrack(track);
    check();
    if (prepareEnhancedMicrophone) {
      await prepareEnhancedMicrophone();
      check();
      await track.unmute();
    }
    check();
    return publication;
  } catch (cause) {
    track.stop();
    await room.localParticipant
      .unpublishTrack(track, true)
      .catch(() => undefined);
    throw cause;
  }
}
