import { RoomEvent, type RemoteParticipant, type Room } from "livekit-client";
import {
  createEphemeralChat,
  roomChatTopic,
  type RoomChatMessage,
} from "./ephemeral-chat";

export type RoomChatStatus =
  "disconnected" | "waiting" | "not-permitted" | "ready";

export function roomChatStatus(
  room: Room | null,
  peerIdentity: string,
  current = true,
): RoomChatStatus {
  if (!current || room?.state !== "connected") return "disconnected";
  if (room.localParticipant.permissions?.canPublishData !== true)
    return "not-permitted";
  if (!peerIdentity || !room.remoteParticipants.has(peerIdentity))
    return "waiting";
  return "ready";
}

export function roomChatStatusMessage(status: RoomChatStatus) {
  switch (status) {
    case "not-permitted":
      return "Máy chủ chưa cấp quyền gửi tin nhắn trong phòng này. Vào lại phòng sau khi quyền được cập nhật.";
    case "waiting":
      return "Chờ người cùng học kết nối vào phòng để gửi tin.";
    case "disconnected":
      return "Chat tạm ngắt khi phòng mất kết nối.";
    case "ready":
      return "Đã kết nối chat trực tiếp";
  }
}

export function createRoomChatTransport(options: {
  room: Room;
  peerIdentity: string;
  isCurrent: () => boolean;
  createId: () => string;
  changed: (messages: RoomChatMessage[]) => void;
  statusChanged: (status: RoomChatStatus) => void;
}) {
  const { room, peerIdentity } = options;
  let closed = false;
  const active = () =>
    !closed &&
    options.isCurrent() &&
    room.state === "connected" &&
    !!peerIdentity;
  const status = () =>
    roomChatStatus(room, peerIdentity, !closed && options.isCurrent());
  const chat = createEphemeralChat({
    peerIdentity,
    active,
    createId: options.createId,
    changed: options.changed,
    publish: async (payload) => {
      const availability = status();
      if (availability !== "ready")
        throw new Error(roomChatStatusMessage(availability));
      await room.localParticipant.publishData(payload, {
        reliable: true,
        topic: roomChatTopic,
        destinationIdentities: [peerIdentity],
      });
    },
  });
  const receive = (
    payload: Uint8Array,
    sender?: RemoteParticipant,
    _kind?: unknown,
    topic?: string,
    _encryption?: unknown,
    senderIdentity?: string,
  ) => {
    // SDK v2 can supply identity before the RemoteParticipant object is available.
    chat.receive(payload, sender?.identity || senderIdentity, topic);
  };
  const update = () => {
    if (!closed) options.statusChanged(status());
  };
  const disconnected = () => {
    retire();
    options.statusChanged("disconnected");
  };
  const events = [
    RoomEvent.ConnectionStateChanged,
    RoomEvent.ParticipantConnected,
    RoomEvent.ParticipantDisconnected,
    RoomEvent.ParticipantPermissionsChanged,
    RoomEvent.Reconnected,
  ] as const;
  room.on(RoomEvent.DataReceived, receive);
  for (const event of events) room.on(event, update);
  room.on(RoomEvent.Disconnected, disconnected);
  function retire() {
    if (closed) return;
    closed = true;
    room.off(RoomEvent.DataReceived, receive);
    for (const event of events) room.off(event, update);
    room.off(RoomEvent.Disconnected, disconnected);
    chat.close();
  }
  return {
    status,
    send: chat.send,
    close: retire,
  };
}
