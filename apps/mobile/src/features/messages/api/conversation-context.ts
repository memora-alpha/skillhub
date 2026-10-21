import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import { parse, resourcePath, uuid } from "@/lib/http/contracts";
import { AppError } from "@/lib/http/errors";
import type { ApiConversation } from "./messages-api";

// Read only the metadata needed by the inbox, not proposal commands or screens.
const proposalContext = z.object({
  id: uuid,
  sourceType: z.enum(["LEARNING_REQUEST", "DIRECT_SEARCH"]),
  learningRequestId: uuid.nullable(),
  proposerId: uuid,
  recipientId: uuid,
  skillId: uuid,
  conversationId: uuid.optional(),
});
const titleContext = z.object({ id: uuid, title: z.string() });
const skillContext = z.object({ id: uuid, name: z.string() });
type ContextConversation = Pick<
  ApiConversation,
  | "id"
  | "proposalId"
  | "learningRequestId"
  | "participantAId"
  | "participantBId"
>;

export function conversationReference(proposalId: string) {
  return `#${proposalId.slice(-8).toUpperCase()}`;
}

export async function readConversationContext(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
  conversation: ContextConversation,
  userId: string,
  signal?: AbortSignal,
  compact = false,
): Promise<string> {
  if (
    ![conversation.participantAId, conversation.participantBId].includes(userId)
  )
    throw new AppError("protocol");
  const proposal = parse(
    proposalContext,
    await call(resourcePath("proposals", conversation.proposalId), { signal }),
  );
  const parties = new Set([
    conversation.participantAId,
    conversation.participantBId,
  ]);
  if (
    proposal.id !== conversation.proposalId ||
    proposal.proposerId === proposal.recipientId ||
    !parties.has(proposal.proposerId) ||
    !parties.has(proposal.recipientId) ||
    proposal.learningRequestId !== conversation.learningRequestId ||
    (proposal.conversationId && proposal.conversationId !== conversation.id) ||
    (proposal.sourceType === "LEARNING_REQUEST") !==
      !!proposal.learningRequestId
  )
    throw new AppError("protocol");

  // A closed/private request may no longer be readable by the other party.
  // Only denied/missing secondary resources fall back; network/protocol errors surface.
  const optional = async (read: () => Promise<string>) => {
    try {
      return await read();
    } catch (error) {
      if (error instanceof AppError && [403, 404].includes(error.status))
        return undefined;
      throw error;
    }
  };
  if (proposal.learningRequestId && !compact) {
    const title = await optional(async () => {
      const request = parse(
        titleContext,
        await call(
          resourcePath("learning-requests", proposal.learningRequestId!),
          { signal },
        ),
      );
      if (request.id !== proposal.learningRequestId)
        throw new AppError("protocol");
      return request.title.trim();
    });
    if (title) return title;
  }
  const skill = await optional(async () => {
    const item = parse(
      skillContext,
      await call(resourcePath("skills", proposal.skillId), { signal }),
    );
    if (item.id !== proposal.skillId) throw new AppError("protocol");
    return item.name.trim();
  });
  return proposal.sourceType === "DIRECT_SEARCH"
    ? skill
      ? `${skill} · Lời mời trực tiếp`
      : "Lời mời trực tiếp"
    : skill
      ? `${skill} · Yêu cầu học`
      : "Yêu cầu học";
}
