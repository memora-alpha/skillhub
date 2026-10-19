import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import {
  parse,
  parsePage,
  resourcePath,
  pageQuery,
  uuid,
  version,
  timestamp,
} from "@/lib/http/contracts";
import {
  createInput,
  updateInput,
  type ProposalHints,
  type ProposalInput,
} from "./proposal-input";
export type { ProposalHints, ProposalInput } from "./proposal-input";

export const proposalSchema = z.object({
  id: uuid,
  sourceType: z.enum(["LEARNING_REQUEST", "DIRECT_SEARCH"]),
  learningRequestId: uuid.nullable(),
  proposerId: uuid,
  recipientId: uuid,
  skillId: uuid,
  message: z.string(),
  exchangeTypeHint: z.enum(["ONE_WAY", "TWO_WAY"]).nullable(),
  proposedCredit: z.string().nullable(),
  proposedDurationMinutes: z.number().int().nullable(),
  initialSessionCount: z.number().int().nullable(),
  candidateSlots: z.string().nullable(),
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"]),
  version,
  expiresAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
  conversationId: uuid.optional(),
});
const acceptedConversation = z.object({
  id: uuid,
  proposalId: uuid,
  learningRequestId: uuid.nullable(),
  participantAId: uuid,
  participantBId: uuid,
  createdAt: timestamp,
});
export type Proposal = z.infer<typeof proposalSchema>;
export type ProposalDecisionResult = {
  proposal: Proposal;
  conversation?: z.infer<typeof acceptedConversation>;
};
export function createProposalsApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
  userId: string,
) {
  const member = (proposal: Proposal, id?: string) => {
    if (
      (id && proposal.id !== id) ||
      proposal.proposerId === proposal.recipientId ||
      ![proposal.proposerId, proposal.recipientId].includes(userId)
    )
      throw new AppError("protocol");
    return proposal;
  };
  return {
    async list(
      direction: "sent" | "received",
      status?: Proposal["status"],
      cursor?: string,
      signal?: AbortSignal,
      learningRequestId?: string,
    ) {
      parse(z.enum(["sent", "received"]), direction);
      if (status) parse(proposalSchema.shape.status, status);
      const query = pageQuery(cursor);
      query.set("direction", direction);
      if (status) query.set("status", status);
      if (learningRequestId) {
        parse(uuid, learningRequestId);
        if (direction !== "received") throw new AppError("protocol");
        query.set("learningRequestId", learningRequestId);
      }
      const page = parsePage(
        proposalSchema,
        await call(`/proposals?${query}`, { includeMeta: true, signal }),
      );
      page.items.forEach((item) => {
        member(item);
        if (
          (direction === "sent" ? item.proposerId : item.recipientId) !==
            userId ||
          (status && item.status !== status) ||
          (learningRequestId && item.learningRequestId !== learningRequestId)
        )
          throw new AppError("protocol");
      });
      return page;
    },
    async detail(id: string, signal?: AbortSignal) {
      return member(
        parse(
          proposalSchema,
          await call(resourcePath("proposals", id), { signal }),
        ),
        id,
      );
    },
    async create(input: ProposalInput, idempotencyKey: string) {
      const body = parse(createInput, input);
      const result = member(
        parse(
          proposalSchema,
          await call("/proposals", { method: "POST", body, idempotencyKey }),
        ),
      );
      if (
        result.proposerId !== userId ||
        result.sourceType !== body.sourceType ||
        (body.sourceType === "LEARNING_REQUEST" &&
          result.learningRequestId !== body.learningRequestId)
      )
        throw new AppError("protocol");
      return result;
    },
    async update(
      id: string,
      input: ProposalHints & { expectedVersion: number },
      idempotencyKey: string,
    ) {
      const body = parse(updateInput, input);
      const result = member(
        parse(
          proposalSchema,
          await call(resourcePath("proposals", id), {
            method: "PATCH",
            body,
            idempotencyKey,
          }),
        ),
        id,
      );
      if (
        result.proposerId !== userId ||
        result.version <= body.expectedVersion
      )
        throw new AppError("protocol");
      return result;
    },
    async decide(
      id: string,
      action: "accept" | "reject" | "withdraw",
      expectedVersion: number,
      idempotencyKey: string,
      expectedRequestVersion?: number,
    ): Promise<ProposalDecisionResult> {
      parse(version, expectedVersion);
      parse(z.enum(["accept", "reject", "withdraw"]), action);
      if (expectedRequestVersion !== undefined) {
        parse(version, expectedRequestVersion);
        if (action !== "accept") throw new AppError("protocol");
      }
      const result = await call(`${resourcePath("proposals", id)}/${action}`, {
        method: "POST",
        body: {
          expectedVersion,
          ...(expectedRequestVersion === undefined
            ? {}
            : { expectedRequestVersion }),
        },
        idempotencyKey,
      });
      if (action !== "accept") {
        const proposal = member(parse(proposalSchema, result), id);
        if (
          proposal.status !==
            (action === "reject" ? "REJECTED" : "WITHDRAWN") ||
          (action === "reject" ? proposal.recipientId : proposal.proposerId) !==
            userId ||
          proposal.version <= expectedVersion
        )
          throw new AppError("protocol");
        return { proposal };
      }
      const accepted = parse(
        z.object({
          proposal: proposalSchema,
          conversation: acceptedConversation,
        }),
        result,
      );
      member(accepted.proposal, id);
      const c = accepted.conversation;
      if (
        accepted.proposal.status !== "ACCEPTED" ||
        accepted.proposal.recipientId !== userId ||
        accepted.proposal.version <= expectedVersion ||
        c.learningRequestId !== accepted.proposal.learningRequestId ||
        c.proposalId !== id ||
        c.participantAId === c.participantBId ||
        ![c.participantAId, c.participantBId].includes(userId) ||
        ![c.participantAId, c.participantBId].includes(
          accepted.proposal.proposerId,
        ) ||
        ![c.participantAId, c.participantBId].includes(
          accepted.proposal.recipientId,
        )
      )
        throw new AppError("protocol");
      return accepted;
    },
  };
}
