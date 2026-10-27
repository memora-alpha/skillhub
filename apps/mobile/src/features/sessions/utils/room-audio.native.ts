import { AudioSession } from "@livekit/react-native";

let queue = Promise.resolve();
let owner: symbol | undefined;

// A retired room must never stop the audio session acquired by its replacement.
export async function acquireRoomAudio() {
  const ticket = Symbol("room-audio");
  const start = queue.then(async () => {
    if (owner === undefined) await AudioSession.startAudioSession();
    owner = ticket;
  });
  queue = start.catch(() => {});
  await start;
  let released = false;
  return () => {
    if (released) return Promise.resolve();
    released = true;
    const stop = queue.then(async () => {
      if (owner !== ticket) return;
      owner = undefined;
      await AudioSession.stopAudioSession();
    });
    queue = stop.catch(() => {});
    return stop;
  };
}
