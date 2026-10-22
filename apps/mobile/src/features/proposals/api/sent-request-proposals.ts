import { AppError } from "@/lib/http/errors";
import type { Proposal } from "./proposals-api";
export type SentRequestProposal = Pick<
  Proposal,
  "id" | "status" | "createdAt" | "updatedAt"
>;
export const sentRequestProposalLabels: Record<Proposal["status"], string> = {
  PENDING: "Đã gửi đề xuất · Chờ phản hồi",
  ACCEPTED: "Đề xuất đã được chấp nhận",
  REJECTED: "Đề xuất trước đã bị từ chối",
  WITHDRAWN: "Bạn đã rút đề xuất trước",
  EXPIRED: "Đề xuất trước đã hết hạn",
};
export function requestProposalIndex(proposals: Proposal[]) {
  const result: Record<string, SentRequestProposal> = {};
  const rank = (status: Proposal["status"]) =>
    status === "PENDING" ? 3 : status === "ACCEPTED" ? 2 : 1;
  for (const proposal of proposals) {
    if (
      proposal.sourceType !== "LEARNING_REQUEST" ||
      !proposal.learningRequestId
    )
      continue;
    const previous = result[proposal.learningRequestId];
    if (
      !previous ||
      rank(proposal.status) > rank(previous.status) ||
      (rank(proposal.status) === rank(previous.status) &&
        (Date.parse(proposal.createdAt) > Date.parse(previous.createdAt) ||
          (proposal.createdAt === previous.createdAt &&
            Date.parse(proposal.updatedAt) > Date.parse(previous.updatedAt))))
    ) {
      result[proposal.learningRequestId] = {
        id: proposal.id,
        status: proposal.status,
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt,
      };
    }
  }
  return result;
}
export async function readSentRequestProposals(
  read: (
    cursor?: string,
    signal?: AbortSignal,
  ) => Promise<{ items: Proposal[]; nextCursor: string | null }>,
  signal: AbortSignal,
) {
  const items: Proposal[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    if (signal.aborted) throw new AppError("session");
    const page = await read(cursor, signal);
    items.push(...page.items);
    if (!page.nextCursor) return requestProposalIndex(items);
    if (seen.has(page.nextCursor)) throw new AppError("protocol");
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
  } while (cursor);
  throw new AppError("protocol");
}
