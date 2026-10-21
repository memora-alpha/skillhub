import { AppError } from "@/lib/http/errors";
import type { Proposal } from "./proposals-api";

export type ProposalTarget = {
  requestId?: string;
  recipientId: string;
  skillId: string;
};
export function matchesPending(proposal: Proposal, target: ProposalTarget) {
  return (
    proposal.status === "PENDING" &&
    (target.requestId
      ? proposal.sourceType === "LEARNING_REQUEST" &&
        proposal.learningRequestId === target.requestId
      : proposal.sourceType === "DIRECT_SEARCH" &&
        proposal.recipientId === target.recipientId &&
        proposal.skillId === target.skillId)
  );
}
export async function findPendingProposal(
  read: (
    cursor?: string,
    signal?: AbortSignal,
  ) => Promise<{ items: Proposal[]; nextCursor: string | null }>,
  target: ProposalTarget,
  signal?: AbortSignal,
) {
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    if (signal?.aborted) throw new AppError("session");
    const page = await read(cursor, signal);
    const found = page.items.find((proposal) =>
      matchesPending(proposal, target),
    );
    if (found) return { id: found.id };
    if (!page.nextCursor) return null;
    if (seen.has(page.nextCursor)) throw new AppError("protocol");
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
  } while (cursor);
  throw new AppError("protocol");
}
