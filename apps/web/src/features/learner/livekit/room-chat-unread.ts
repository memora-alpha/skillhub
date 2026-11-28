import type { RoomChatMessage } from "./ephemeral-chat";

export type RoomChatMode = "floating" | "minimized" | "maximized";

export const ROOM_CHAT_TOAST_MS = 5000;

export type RoomChatPanelState = {
  open: boolean;
  mode: RoomChatMode;
  restoreMode: "floating" | "maximized";
  lastReadId: string | undefined;
  dismissedToastId: string | undefined;
};

export function createRoomChatPanelState(): RoomChatPanelState {
  return {
    open: false,
    mode: "floating",
    restoreMode: "floating",
    lastReadId: undefined,
    dismissedToastId: undefined,
  };
}

export function isViewingRoomChat(
  state: Pick<RoomChatPanelState, "open" | "mode">,
  joined: boolean,
): boolean {
  return joined && state.open && state.mode !== "minimized";
}

export function unreadRoomChatMessages(
  messages: readonly RoomChatMessage[],
  lastReadId: string | undefined,
  viewing: boolean,
): RoomChatMessage[] {
  if (viewing || messages.length === 0) return [];
  const seenIndex = lastReadId
    ? messages.findIndex((message) => message.id === lastReadId)
    : -1;
  return messages.slice(seenIndex + 1).filter((message) => !message.own);
}

export function latestUnreadToastMessage(
  unreadMessages: readonly RoomChatMessage[],
  chatOpen: boolean,
  dismissedToastId: string | undefined,
): RoomChatMessage | undefined {
  if (chatOpen) return undefined;
  const latest = unreadMessages.at(-1);
  if (!latest || latest.id === dismissedToastId) return undefined;
  return latest;
}

export function formatRoomChatBadge(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count > 99 ? "99+" : String(count);
}

export function roomChatControlLabel(
  totalCount: number,
  unreadCount: number,
): string {
  if (unreadCount > 0) {
    return unreadCount > 99
      ? "Chat phiên học (hơn 99 tin nhắn mới)"
      : `Chat phiên học (${unreadCount} tin nhắn mới)`;
  }
  return `Chat phiên học (${totalCount} tin)`;
}

export function openRoomChatState(
  state: RoomChatPanelState,
  messages: readonly RoomChatMessage[],
): RoomChatPanelState {
  return {
    ...state,
    open: true,
    mode: state.mode === "minimized" ? state.restoreMode : state.mode,
    lastReadId: messages.at(-1)?.id,
  };
}

export function toggleRoomChatState(
  state: RoomChatPanelState,
  messages: readonly RoomChatMessage[],
): RoomChatPanelState {
  if (!state.open || state.mode === "minimized") {
    return openRoomChatState(state, messages);
  }
  return {
    ...state,
    open: false,
    lastReadId: messages.at(-1)?.id,
  };
}

export function closeRoomChatState(
  state: RoomChatPanelState,
  messages: readonly RoomChatMessage[],
): RoomChatPanelState {
  if (state.open && state.mode !== "minimized") {
    return {
      ...state,
      open: false,
      lastReadId: messages.at(-1)?.id,
    };
  }
  const latestUnread = unreadRoomChatMessages(
    messages,
    state.lastReadId,
    false,
  ).at(-1);
  return {
    ...state,
    open: false,
    dismissedToastId: latestUnread?.id ?? state.dismissedToastId,
  };
}

export function toggleMinimizeRoomChatState(
  state: RoomChatPanelState,
  messages: readonly RoomChatMessage[],
): RoomChatPanelState {
  if (state.mode === "minimized") {
    return {
      ...state,
      mode: state.restoreMode,
      lastReadId: messages.at(-1)?.id,
    };
  }
  return {
    ...state,
    restoreMode: state.mode,
    mode: "minimized",
    lastReadId: messages.at(-1)?.id,
  };
}

export function toggleMaximizeRoomChatState(
  state: RoomChatPanelState,
  messages: readonly RoomChatMessage[],
): RoomChatPanelState {
  if (state.mode === "maximized") {
    return {
      ...state,
      mode: "floating",
    };
  }
  return {
    ...state,
    mode: "maximized",
    lastReadId:
      state.mode === "minimized" ? messages.at(-1)?.id : state.lastReadId,
  };
}

export function dismissRoomChatToastState(
  state: RoomChatPanelState,
  messageId: string,
): RoomChatPanelState {
  if (state.dismissedToastId === messageId) return state;
  return {
    ...state,
    dismissedToastId: messageId,
  };
}
