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
import { conversations } from "../mocks/conversations";
import { initialThreads, type ChatMessage } from "../mocks/chat";

type MessagesContextValue = {
  threads: Record<string, ChatMessage[]>;
  read: string[];
  markRead: (proposal: string) => void;
  send: (proposal: string, text: string) => void;
};
const MessagesContext = createContext<MessagesContextValue | null>(null);

export function MockMessagesProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { session } = useAuthSession();
  const [threads, setThreads] = useState(initialThreads);
  const [read, setRead] = useState<string[]>([]);
  // Reset local messages when the signed-in account changes, without remounting navigation.
  useEffect(() => {
    setThreads(initialThreads);
    setRead([]);
  }, [session?.userId]);
  const markRead = useCallback(
    (proposal: string) =>
      setRead((current) =>
        current.includes(proposal) ? current : [...current, proposal],
      ),
    [],
  );
  const send = useCallback(
    (proposal: string, text: string) => {
      if (
        !text.trim() ||
        !conversations.some((item) => item.proposal === proposal)
      )
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
    [markRead],
  );
  const value = useMemo(
    () => ({ threads, read, markRead, send }),
    [markRead, read, send, threads],
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
