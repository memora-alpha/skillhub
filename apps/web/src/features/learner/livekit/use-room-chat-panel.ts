"use client";
import { useEffect, useState } from "react";
import type { RoomChatMessage } from "./ephemeral-chat";
import {
  ROOM_CHAT_TOAST_MS,
  closeRoomChatState,
  createRoomChatPanelState,
  dismissRoomChatToastState,
  formatRoomChatBadge,
  isViewingRoomChat,
  latestUnreadToastMessage,
  openRoomChatState,
  toggleMaximizeRoomChatState,
  toggleMinimizeRoomChatState,
  toggleRoomChatState,
  unreadRoomChatMessages,
} from "./room-chat-unread";

export function useRoomChatPanel(
  messages: readonly RoomChatMessage[],
  joined: boolean,
) {
  const [state, setState] = useState(createRoomChatPanelState);
  const viewing = isViewingRoomChat(state, joined);
  const unreadMessages = unreadRoomChatMessages(
    messages,
    state.lastReadId,
    viewing,
  );
  const unreadCount = unreadMessages.length;
  const latestUnread = unreadMessages.at(-1);
  const toastMessage = joined
    ? latestUnreadToastMessage(
        unreadMessages,
        state.open,
        state.dismissedToastId,
      )
    : undefined;
  const toastId = toastMessage?.id;

  useEffect(() => {
    if (!toastId) return;
    const timer = window.setTimeout(() => {
      setState((current) => dismissRoomChatToastState(current, toastId));
    }, ROOM_CHAT_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toastId]);

  return {
    open: state.open,
    mode: state.mode,
    unreadCount,
    badge: formatRoomChatBadge(unreadCount),
    latestUnread,
    toastMessage,
    openChat: () => setState((current) => openRoomChatState(current, messages)),
    toggleChat: () =>
      setState((current) => toggleRoomChatState(current, messages)),
    closeChat: () =>
      setState((current) => closeRoomChatState(current, messages)),
    toggleMinimize: () =>
      setState((current) => toggleMinimizeRoomChatState(current, messages)),
    toggleMaximize: () =>
      setState((current) => toggleMaximizeRoomChatState(current, messages)),
    dismissToast: () => {
      if (!toastId) return;
      setState((current) => dismissRoomChatToastState(current, toastId));
    },
  };
}
