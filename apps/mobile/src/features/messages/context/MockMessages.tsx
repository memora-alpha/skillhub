import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useAuthSession } from "@/features/auth";
import { conversations, type Conversation } from "../mocks/conversations";
import { initialThreads, type ChatMessage } from "../mocks/chat";

type MessagesContextValue = {
  conversations: Conversation[];
  openConversation: (conversation: Conversation) => void;
  threads: Record<string, ChatMessage[]>;
  read: string[];
  markRead: (proposal: string) => void;
  send: (proposal: string, text: string) => void;
  sendFile: (
    proposal: string,
    file: { name: string; bytes: number },
  ) => boolean;
};
const MessagesContext = createContext<MessagesContextValue | null>(null);

export function MockMessagesProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { session } = useAuthSession();
  const [items, setItems] = useState(conversations);
  const [threads, setThreads] = useState(initialThreads);
  const [read, setRead] = useState<string[]>([]);
  // Reset local messages when the signed-in account changes, without remounting navigation.
  useEffect(() => {
    setItems(conversations);
    setThreads(initialThreads);
    setRead([]);
  }, [session?.userId]);
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
      sendFile: (proposal: string, file: { name: string; bytes: number }) => {
        if (
          file.bytes > 15 * 1024 * 1024 ||
          file.bytes <= 0 ||
          !items.some((i) => i.proposal === proposal)
        )
          return false;
        setThreads((current) => ({
          ...current,
          [proposal]: [
            ...(current[proposal] ?? []),
            {
              id: `file-${Date.now()}-${current[proposal]?.length ?? 0}`,
              from: "me",
              text: `Tệp mẫu: ${file.name}`,
              file,
              time: new Date().toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ],
        }));
        markRead(proposal);
        return true;
      },
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
