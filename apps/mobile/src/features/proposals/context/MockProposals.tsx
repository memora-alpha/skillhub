import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuthSession } from "@/features/auth";
import { useMockMessages } from "@/features/messages";
import { initialProposals, type DemoProposal } from "../mocks/proposals";

type ProposalDraft = Omit<DemoProposal, "id" | "direction" | "time" | "status">;
type ProposalStore = {
  proposals: DemoProposal[];
  submit: (draft: ProposalDraft) => boolean;
  decide: (
    id: string,
    status: "ACCEPTED" | "REJECTED" | "WITHDRAWN",
  ) => boolean;
};
const Context = createContext<ProposalStore | null>(null);

export function MockProposalsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuthSession();
  const { openConversation } = useMockMessages();
  const [proposals, setProposals] = useState(initialProposals);
  const current = useRef(proposals);
  const sequence = useRef(0);
  const replace = (items: DemoProposal[]) => {
    current.current = items;
    setProposals(items);
  };
  useEffect(() => {
    current.current = initialProposals;
    setProposals(initialProposals);
  }, [session?.userId]);
  const submit = (draft: ProposalDraft) => {
    if (
      !session ||
      current.current.some(
        (item) =>
          item.direction === "sent" &&
          item.status === "PENDING" &&
          item.partnerId === draft.partnerId &&
          item.requestId === draft.requestId &&
          item.sourceType === draft.sourceType,
      )
    )
      return false;
    replace([
      {
        ...draft,
        id: `local-proposal-${Date.now()}-${++sequence.current}`,
        direction: "sent",
        time: "Vừa xong",
        status: "PENDING",
      },
      ...current.current,
    ]);
    return true;
  };
  const decide = (
    id: string,
    status: "ACCEPTED" | "REJECTED" | "WITHDRAWN",
  ) => {
    const item = current.current.find((proposal) => proposal.id === id);
    if (
      !session ||
      !item ||
      item.status !== "PENDING" ||
      (status === "WITHDRAWN"
        ? item.direction !== "sent"
        : item.direction !== "received")
    )
      return false;
    if (
      status === "ACCEPTED" &&
      item.requestId !== undefined &&
      current.current.some(
        (other) =>
          other.requestId === item.requestId && other.status === "ACCEPTED",
      )
    )
      return false;
    replace(
      current.current.map((proposal) =>
        proposal.id === id ? { ...proposal, status } : proposal,
      ),
    );
    if (status === "ACCEPTED")
      openConversation({
        proposal: item.id,
        name: item.partner,
        userId: item.partnerId,
        skill: item.skill,
        request: item.requestTitle,
        last: "Đề xuất đã chấp nhận. Bắt đầu trao đổi về lộ trình và lịch học.",
        messages: 0,
        unread: 0,
        time: "Vừa xong",
      });
    return true;
  };
  return (
    <Context.Provider value={{ proposals, submit, decide }}>
      {children}
    </Context.Provider>
  );
}

export function useMockProposals() {
  const value = useContext(Context);
  if (!value) throw new Error("MockProposalsProvider is required.");
  return value;
}
