import { RoomEvent, type RemoteParticipant, type Room } from "livekit-client";
import {
  isWhiteboardElement,
  type WhiteboardElement,
} from "./whiteboard-scene";

export const whiteboardTopic = "skillhub.whiteboard.v1";

type WhiteboardPacket =
  | { type: "wb:toggle"; open: boolean }
  | { type: "wb:delta"; elements: WhiteboardElement[] }
  | {
      type: "wb:delta_chunk";
      batchId: string;
      index: number;
      total: number;
      data: string;
    }
  | { type: "wb:sync_req" }
  | { type: "wb:sync_res"; elements: WhiteboardElement[] };

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const maxChunkChars = 9000;

export function createRoomWhiteboardTransport(options: {
  room: Room;
  peerIdentity: string;
  onToggle: (open: boolean) => void;
  onElements: (elements: WhiteboardElement[]) => void;
  onSyncRequest: () => void;
}) {
  const { room, peerIdentity } = options;
  let closed = false;
  const pendingChunks = new Map<
    string,
    { total: number; parts: Map<number, string>; receivedAt: number }
  >();

  async function publishRaw(packet: WhiteboardPacket) {
    if (
      closed ||
      room.state !== "connected" ||
      room.localParticipant.permissions?.canPublishData !== true ||
      !peerIdentity ||
      !room.remoteParticipants.has(peerIdentity)
    )
      return;
    const raw = JSON.stringify(packet);
    const bytes = encoder.encode(raw);
    if (bytes.byteLength <= 12_000 || packet.type === "wb:delta_chunk") {
      await room.localParticipant
        .publishData(bytes, {
          reliable: true,
          topic: whiteboardTopic,
          destinationIdentities: [peerIdentity],
        })
        .catch(() => undefined);
      return;
    }
    const batchId = crypto.randomUUID();
    const total = Math.ceil(raw.length / maxChunkChars);
    for (let index = 0; index < total; index++) {
      const data = raw.slice(
        index * maxChunkChars,
        (index + 1) * maxChunkChars,
      );
      const chunkBytes = encoder.encode(
        JSON.stringify({
          type: "wb:delta_chunk",
          batchId,
          index,
          total,
          data,
        } satisfies WhiteboardPacket),
      );
      await room.localParticipant
        .publishData(chunkBytes, {
          reliable: true,
          topic: whiteboardTopic,
          destinationIdentities: [peerIdentity],
        })
        .catch(() => undefined);
    }
  }

  function handleParsed(parsed: unknown) {
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) return;
    const msg = parsed as Record<string, unknown>;
    if (msg.type === "wb:toggle" && typeof msg.open === "boolean") {
      options.onToggle(msg.open);
    } else if (
      (msg.type === "wb:delta" || msg.type === "wb:sync_res") &&
      Array.isArray(msg.elements)
    ) {
      const valid = msg.elements.filter(isWhiteboardElement);
      if (valid.length) options.onElements(valid);
    } else if (msg.type === "wb:sync_req") {
      options.onSyncRequest();
    } else if (
      msg.type === "wb:delta_chunk" &&
      typeof msg.batchId === "string" &&
      typeof msg.index === "number" &&
      typeof msg.total === "number" &&
      typeof msg.data === "string" &&
      msg.total > 0 &&
      msg.total <= 200 &&
      msg.index >= 0 &&
      msg.index < msg.total
    ) {
      const now = Date.now();
      for (const [id, entry] of pendingChunks) {
        if (now - entry.receivedAt > 30_000) pendingChunks.delete(id);
      }
      const bucket = pendingChunks.get(msg.batchId) ?? {
        total: msg.total,
        parts: new Map<number, string>(),
        receivedAt: now,
      };
      bucket.parts.set(msg.index, msg.data);
      pendingChunks.set(msg.batchId, bucket);
      if (bucket.parts.size === bucket.total) {
        pendingChunks.delete(msg.batchId);
        let full = "";
        for (let i = 0; i < bucket.total; i++)
          full += bucket.parts.get(i) ?? "";
        try {
          handleParsed(JSON.parse(full));
        } catch {
          /* Ignore malformed peer packet. */
        }
      }
    }
  }

  const receive = (
    payload: Uint8Array,
    sender?: RemoteParticipant,
    _kind?: unknown,
    topic?: string,
    _encryption?: unknown,
    senderIdentity?: string,
  ) => {
    if (closed || topic !== whiteboardTopic) return;
    const from = sender?.identity || senderIdentity;
    if (peerIdentity && from && from !== peerIdentity) return;
    try {
      handleParsed(JSON.parse(decoder.decode(payload)));
    } catch {
      /* Ignore malformed peer payload. */
    }
  };

  room.on(RoomEvent.DataReceived, receive);

  return {
    sendToggle: (open: boolean) => void publishRaw({ type: "wb:toggle", open }),
    sendDelta: (elements: WhiteboardElement[]) => {
      if (elements.length) void publishRaw({ type: "wb:delta", elements });
    },
    requestSync: () => void publishRaw({ type: "wb:sync_req" }),
    sendSync: (elements: WhiteboardElement[]) => {
      if (elements.length) void publishRaw({ type: "wb:sync_res", elements });
    },
    close() {
      if (closed) return;
      closed = true;
      pendingChunks.clear();
      room.off(RoomEvent.DataReceived, receive);
    },
  };
}
