"use client";
import { useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { ContactInformationError } from "@/lib/contact-policy";
import type { RoomChatMessage } from "./ephemeral-chat";
import {
  createRoomChatTransport,
  roomChatStatusMessage,
  type RoomChatStatus,
} from "./room-chat-transport";

export function useRoomChat(
  room: Room | null,
  peerIdentity: string,
  createId: () => string,
  isCurrent: () => boolean,
) {
  const [history, setHistory] = useState<{
    room: Room | null;
    peer: string;
    messages: RoomChatMessage[];
  }>();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<RoomChatStatus>("disconnected");
  const [error, setError] = useState("");
  const current = useRef(isCurrent);
  useEffect(() => {
    current.current = isCurrent;
  }, [isCurrent]);
  const controller = useRef<ReturnType<typeof createRoomChatTransport> | null>(
    null,
  );
  useEffect(() => {
    let alive = true;
    const chat = room
      ? createRoomChatTransport({
          room,
          peerIdentity,
          isCurrent: () => alive && current.current(),
          createId,
          changed: (messages) => {
            if (alive) setHistory({ room, peer: peerIdentity, messages });
          },
          statusChanged: (availability) => {
            if (alive) {
              setStatus(availability);
              if (availability === "ready") setError("");
            }
          },
        })
      : null;
    controller.current = chat;
    queueMicrotask(() => {
      if (alive) {
        setHistory({ room, peer: peerIdentity, messages: [] });
        setPending(false);
        setError("");
        setStatus(chat?.status() ?? "disconnected");
      }
    });
    return () => {
      alive = false;
      chat?.close();
      if (controller.current === chat) controller.current = null;
    };
  }, [room, peerIdentity, createId]);
  async function send(text: string) {
    const chat = controller.current;
    if (!chat || !current.current()) return false;
    const availability = chat.status();
    if (availability !== "ready") {
      setStatus(availability);
      setError(roomChatStatusMessage(availability));
      return false;
    }
    setPending(true);
    setError("");
    try {
      return await chat.send(text);
    } catch (cause) {
      if (controller.current === chat && current.current()) {
        const availability = chat.status();
        setStatus(availability);
        const fallback =
          availability === "ready"
            ? "Chưa gửi được tin nhắn. Kiểm tra kết nối rồi gửi lại."
            : roomChatStatusMessage(availability);
        setError(
          cause instanceof ContactInformationError ? cause.message : fallback,
        );
      }
      return false;
    } finally {
      if (controller.current === chat && current.current()) setPending(false);
    }
  }
  const messages =
    history?.room === room && history.peer === peerIdentity
      ? history.messages
      : [];
  return {
    messages,
    pending,
    ready: status === "ready",
    status,
    statusMessage: roomChatStatusMessage(status),
    error,
    send,
  };
}
