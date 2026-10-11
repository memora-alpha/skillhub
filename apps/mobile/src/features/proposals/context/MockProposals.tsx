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
import {
  decidePendingProposal,
  updatePendingProposal,
  type ProposalChanges,
} from "../utils/proposal-transitions";

type ProposalDraft = Omit<DemoProposal, "id" | "direction" | "time" | "status">;
type ProposalStore = {
  proposals: DemoProposal[];
  submit: (draft: ProposalDraft) => boolean;
  update: (id: string, changes: ProposalChanges) => boolean;
  decide: (
    id: string,
    status: "ACCEPTED" | "REJECTED" | "WITHDRAWN",
    localDecisionNote?: string,
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
  const update = (id: string, changes: ProposalChanges) => {
    if (!session) return false;
    const next = updatePendingProposal(current.current, id, changes);
    if (!next) return false;
    replace(next);
    return true;
  };
  const decide = (
    id: string,
    status: "ACCEPTED" | "REJECTED" | "WITHDRAWN",
    localDecisionNote?: string,
  ) => {
    const item = current.current.find((proposal) => proposal.id === id);
    if (!session || !item) return false;
    const next = decidePendingProposal(
      current.current,
      id,
      status,
      localDecisionNote,
    );
    if (!next) return false;
    replace(next);
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
    <Context.Provider value={{ proposals, submit, update, decide }}>
      {children}
    </Context.Provider>
  );
}

export function useMockProposals() {
  const value = useContext(Context);
  if (!value) throw new Error("MockProposalsProvider is required.");
  return value;
}
