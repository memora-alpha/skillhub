import type { DemoProposal } from "../mocks/proposals";
import { proposalFormSchema } from "../schemas/proposal-form";

export type ProposalChanges = Pick<
  DemoProposal,
  "message" | "credit" | "sessions" | "schedule"
>;
export type ProposalDecision = "ACCEPTED" | "REJECTED" | "WITHDRAWN";

export function updatePendingProposal(
  items: DemoProposal[],
  id: string,
  changes: ProposalChanges,
) {
  const item = items.find((proposal) => proposal.id === id);
  const parsed = proposalFormSchema.safeParse({
    ...changes,
    sessions: String(changes.sessions),
  });
  if (
    !item ||
    item.direction !== "sent" ||
    item.status !== "PENDING" ||
    !parsed.success
  )
    return null;
  return items.map((proposal) =>
    proposal.id === id
      ? {
          ...proposal,
          ...parsed.data,
          sessions: Number(parsed.data.sessions),
          time: "Vừa cập nhật",
        }
      : proposal,
  );
}

export function decidePendingProposal(
  items: DemoProposal[],
  id: string,
  status: ProposalDecision,
  localDecisionNote?: string,
) {
  const item = items.find((proposal) => proposal.id === id);
  if (
    !item ||
    item.status !== "PENDING" ||
    (status === "WITHDRAWN"
      ? item.direction !== "sent"
      : item.direction !== "received")
  )
    return null;
  if (
    status === "ACCEPTED" &&
    item.requestId !== undefined &&
    items.some(
      (other) =>
        other.requestId === item.requestId && other.status === "ACCEPTED",
    )
  )
    return null;
  return items.map((proposal) =>
    proposal.id === id
      ? {
          ...proposal,
          status,
          localDecisionNote:
            status === "REJECTED" ? localDecisionNote?.trim() : undefined,
        }
      : proposal,
  );
}
