export const roomChatTopic = "skillhub.session-chat.v1";
export const roomChatTextLimit = 1000;
export type RoomChatMessage = { id: string; text: string; own: boolean };
type Packet = { v: 1; id: string; text: string };
const validId = (id: unknown): id is string =>
  typeof id === "string" && /^[a-z0-9-]{8,80}$/i.test(id);

// Only RAM belongs to this room attempt. No history API, cache or device storage.
export function createEphemeralChat(options: {
  peerIdentity: string;
  active: () => boolean;
  publish: (data: Uint8Array<ArrayBuffer>) => Promise<void>;
  createId: () => string;
  changed: (items: RoomChatMessage[]) => void;
}) {
  let closed = false;
  let sending = false;
  let messages: RoomChatMessage[] = [];
  const seen = new Set<string>();
  const append = (packet: Packet, own: boolean) => {
    if (closed || seen.has(packet.id)) return;
    seen.add(packet.id);
    if (seen.size > 500) seen.delete(seen.values().next().value!);
    messages = [...messages, { id: packet.id, text: packet.text, own }].slice(
      -100,
    );
    options.changed(messages);
  };
  return {
    receive(data: Uint8Array, sender: string | undefined, topic?: string) {
      if (
        closed ||
        !options.active() ||
        sender !== options.peerIdentity ||
        topic !== roomChatTopic ||
        data.byteLength > 8192
      )
        return;
      try {
        const packet = JSON.parse(
          new TextDecoder().decode(data),
        ) as Partial<Packet>;
        if (
          packet?.v !== 1 ||
          !validId(packet.id) ||
          typeof packet.text !== "string" ||
          !packet.text.trim() ||
          packet.text.length > roomChatTextLimit
        )
          return;
        append({ v: 1, id: packet.id, text: packet.text }, false);
      } catch {
        /* Ignore malformed or unrelated room data. */
      }
    },
    async send(value: string) {
      const text = value.trim();
      if (
        closed ||
        sending ||
        !options.active() ||
        !text ||
        text.length > roomChatTextLimit
      )
        return false;
      const packet: Packet = { v: 1, id: options.createId(), text };
      if (!validId(packet.id)) return false;
      sending = true;
      try {
        await options.publish(new TextEncoder().encode(JSON.stringify(packet)));
        if (closed || !options.active()) return false;
        append(packet, true);
        return true;
      } finally {
        sending = false;
      }
    },
    close() {
      closed = true;
      messages = [];
      seen.clear();
      options.changed([]);
    },
  };
}
