import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useMockSession } from "@/features/auth";
import { conversations, type Conversation } from "../mocks/conversations";
import { initialThreads, type ChatMessage } from "../mocks/chat";

type MessagesContextValue = {
  conversations: Conversation[];
  openConversation: (conversation: Conversation) => void;
  threads: Record<string, ChatMessage[]>;
  read: string[];
  markRead: (proposal: string) => void;
  send: (proposal: string, text: string) => void;
};
const MessagesContext = createContext<MessagesContextValue | null>(null);

export function MockMessagesProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { session } = useMockSession();
  const [items, setItems] = useState(conversations);
  const [threads, setThreads] = useState(initialThreads);
  const [read, setRead] = useState<string[]>([]);
  // Reset local messages when the demo session changes, without remounting navigation.
  useEffect(() => {
    setItems(conversations);
    setThreads(initialThreads);
    setRead([]);
  }, [session?.email]);
  const openConversation = useCallback((conversation: Conversation) => {
    setItems((current) =>
      current.some((item) => item.proposal === conversation.proposal)
        ? current
        : [conversation, ...current],
    );
    setThreads((current) =>
      current[conversation.proposal]
        ? current
        : {
            ...current,
            [conversation.proposal]: [],
          },
    );
  }, []);
  const markRead = useCallback(
    (proposal: string) =>
      setRead((current) =>
        current.includes(proposal) ? current : [...current, proposal],
      ),
    [],
  );
  const send = useCallback(
    (proposal: string, text: string) => {
      if (!text.trim() || !items.some((item) => item.proposal === proposal))
        return;
      setThreads((current) => {
        const previous = current[proposal] ?? [];
        const message: ChatMessage = {
          id: `local-${Date.now()}-${previous.length}`,
          from: "me",
          text: text.trim(),
          time: new Date().toLocaleTimeString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        return { ...current, [proposal]: [...previous, message] };
      });
      markRead(proposal);
    },
    [items, markRead],
  );
  const value = useMemo(
    () => ({
      conversations: items,
      openConversation,
      threads,
      read,
      markRead,
      send,
    }),
    [items, openConversation, markRead, read, send, threads],
  );
  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  );
}
export function useMockMessages() {
  const value = useContext(MessagesContext);
  if (!value) throw new Error("MockMessagesProvider is required.");
  return value;
}
