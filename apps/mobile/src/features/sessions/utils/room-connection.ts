import type { LiveKitCredentials } from "../api/livekit-contract";

type ConnectionOptions = {
  isCurrent: () => boolean;
  load: (signal: AbortSignal) => Promise<LiveKitCredentials>;
  connect: (
    credentials: LiveKitCredentials,
    active: () => boolean,
  ) => Promise<void>;
  disconnect: () => Promise<unknown>;
  connected: () => void;
  failed: (error: unknown) => void;
};

// Own a single room attempt; late token/RTC completions cannot revive a closed call.
export function createRoomConnection(options: ConnectionOptions) {
  const abort = new AbortController();
  let closed = false;
  let pending: Promise<void> | undefined;
  const active = () => !closed && options.isCurrent();
  const disconnect = async () => {
    try {
      await options.disconnect();
    } catch {
      /* The room is already retiring. */
    }
  };
  return {
    active,
    start() {
      if (!active()) return Promise.resolve();
      if (pending) return pending;
      pending = (async () => {
        try {
          const credentials = await options.load(abort.signal);
          if (!active()) return;
          await options.connect(credentials, active);
          if (!active()) {
            await disconnect();
            return;
          }
          options.connected();
        } catch (error) {
          await disconnect();
          if (active()) options.failed(error);
        }
      })();
      return pending;
    },
    close() {
      closed = true;
      abort.abort();
      return disconnect();
    },
  };
}
