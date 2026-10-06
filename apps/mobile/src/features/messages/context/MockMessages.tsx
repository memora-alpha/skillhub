import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useMockSession } from "@/features/auth/context/MockSession";
import { conversations } from "../mocks/conversations";
import { initialThreads, type ChatMessage } from "../mocks/chat";

type MessagesContextValue = {
  threads: Record<string, ChatMessage[]>;
  read: string[];
  markRead: (proposal: string) => void;
  send: (proposal: string, text: string) => void;
};
const MessagesContext = createContext<MessagesContextValue | null>(null);

export function MockMessagesProvider({ children }: { children: ReactNode }) {
  const { session } = useMockSession();
  const [threads, setThreads] = useState(initialThreads);
  const [read, setRead] = useState<string[]>([]);
  // Reset local messages when the demo session changes, without remounting navigation.
  useEffect(() => {
    setThreads(initialThreads);
    setRead([]);
  }, [session?.email]);
  const markRead = useCallback(
    (proposal: string) =>
      setRead((current) =>
        current.includes(proposal) ? current : [...current, proposal],
      ),
    [],
  );
  const send = (proposal: string, text: string) => {
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
  };
  return (
    <MessagesContext.Provider value={{ threads, read, markRead, send }}>
      {children}
    </MessagesContext.Provider>
  );
}
export function useMockMessages() {
  const value = useContext(MessagesContext);
  if (!value) throw new Error("MockMessagesProvider is required.");
  return value;
}
