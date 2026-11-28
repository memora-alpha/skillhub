import { RoomEvent, type Room, type RemoteParticipant } from "livekit-client";
import {
  boardElementSchema,
  type BoardElement,
} from "../api/classroom-contracts";

const topic = "skillhub.whiteboard.v1";
const encoder = new TextEncoder(),
  decoder = new TextDecoder();
export function createWhiteboardTransport(options: {
  room: Room;
  peerIdentity: string;
  isCurrent: () => boolean;
  createId: () => string;
  elements: () => BoardElement[];
  received: (rows: BoardElement[]) => void;
  toggled: (open: boolean) => void;
}) {
  const { room, peerIdentity } = options;
  let closed = false;
  const chunks = new Map<
    string,
    { parts: Map<number, string>; total: number; at: number }
  >();
  const active = () =>
    !closed && options.isCurrent() && room.state === "connected";
  async function publish(packet: unknown) {
    if (
      !active() ||
      room.localParticipant.permissions?.canPublishData !== true ||
      !room.remoteParticipants.has(peerIdentity)
    )
      return;
    const raw = JSON.stringify(packet);
    if (encoder.encode(raw).byteLength > 2 * 1024 * 1024) return;
    const send = (value: unknown) =>
      room.localParticipant.publishData(encoder.encode(JSON.stringify(value)), {
        reliable: true,
        topic,
        destinationIdentities: [peerIdentity],
      });
    try {
      if (encoder.encode(raw).byteLength <= 12_000) await send(packet);
      else {
        const batchId = options.createId(),
          total = Math.ceil(raw.length / 3000);
        if (total > 200) return; // Large scenes still converge via the versioned API.
        // Sequential chunks keep the reliable channel bounded on mobile networks.
        for (let index = 0; index < total && active(); index++)
          await send({
            type: "wb:delta_chunk",
            batchId,
            index,
            total,
            data: raw.slice(index * 3000, (index + 1) * 3000),
          });
      }
    } catch {
      /* The versioned API snapshot remains authoritative. */
    }
  }
  function handle(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const msg = value as Record<string, unknown>;
    if (msg.type === "wb:sync_req") {
      void publish({ type: "wb:sync_res", elements: options.elements() });
    } else if (msg.type === "wb:toggle" && typeof msg.open === "boolean") {
      options.toggled(msg.open);
    } else if (
      (msg.type === "wb:delta" || msg.type === "wb:sync_res") &&
      Array.isArray(msg.elements) &&
      msg.elements.length <= 20_000
    ) {
      const rows = boardElementSchema.array().safeParse(msg.elements);
      if (rows.success) options.received(rows.data);
    } else if (msg.type === "wb:delta_chunk") {
      for (const [key, bucket] of chunks)
        if (Date.now() - bucket.at > 30_000) chunks.delete(key);
      if (
        typeof msg.batchId !== "string" ||
        msg.batchId.length > 128 ||
        typeof msg.data !== "string" ||
        msg.data.length > 9000 ||
        !Number.isInteger(msg.index) ||
        !Number.isInteger(msg.total)
      )
        return;
      const index = msg.index as number,
        total = msg.total as number;
      if (total < 1 || total > 200 || index < 0 || index >= total) return;
      if (!chunks.has(msg.batchId) && chunks.size >= 4) return;
      const bucket = chunks.get(msg.batchId) ?? {
        total,
        parts: new Map(),
        at: Date.now(),
      };
      if (bucket.total !== total) return;
      bucket.parts.set(index, msg.data);
      chunks.set(msg.batchId, bucket);
      if (bucket.parts.size === total) {
        chunks.delete(msg.batchId);
        const raw = Array.from({ length: total }, (_, i) =>
          bucket.parts.get(i)!,
        ).join("");
        if (encoder.encode(raw).byteLength > 2 * 1024 * 1024) return;
        try {
          handle(JSON.parse(raw));
        } catch {
          /* Ignore malformed peer data. */
        }
      }
    }
  }
  const receive = (
    payload: Uint8Array,
    sender?: RemoteParticipant,
    _kind?: unknown,
    receivedTopic?: string,
    _encryption?: unknown,
    senderIdentity?: string,
  ) => {
    if (
      !active() ||
      receivedTopic !== topic ||
      (sender?.identity || senderIdentity) !== peerIdentity ||
      payload.byteLength > 32_000
    )
      return;
    try {
      handle(JSON.parse(decoder.decode(payload)));
    } catch {
      /* Ignore invalid packets. */
    }
  };
  const sync = () => {
    void publish({ type: "wb:sync_req" });
  };
  room.on(RoomEvent.DataReceived, receive);
  room.on(RoomEvent.ParticipantConnected, sync);
  room.on(RoomEvent.Reconnected, sync);
  sync();
  return {
    send: (elements: BoardElement[]) => {
      void publish({ type: "wb:delta", elements });
    },
    toggle: (open: boolean) => {
      void publish({ type: "wb:toggle", open });
    },
    sync,
    close() {
      closed = true;
      chunks.clear();
      room.off(RoomEvent.DataReceived, receive);
      room.off(RoomEvent.ParticipantConnected, sync);
      room.off(RoomEvent.Reconnected, sync);
    },
  };
}
