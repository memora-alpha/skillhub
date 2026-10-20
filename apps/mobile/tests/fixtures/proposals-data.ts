import type { Proposal } from "../../src/features/proposals/api/proposals-api";
import { fixtureId } from "./learning-requests-data";
export const proposerId = fixtureId(1),
  recipientId = fixtureId(2);
export const proposal: Proposal = {
  id: fixtureId(500),
  sourceType: "LEARNING_REQUEST",
  learningRequestId: fixtureId(200),
  proposerId,
  recipientId,
  skillId: fixtureId(10),
  message: "Tôi có thể hướng dẫn bạn học TypeScript.",
  exchangeTypeHint: null,
  proposedCredit: null,
  proposedDurationMinutes: null,
  initialSessionCount: null,
  candidateSlots: null,
  status: "PENDING",
  version: 1,
  expiresAt: "2026-12-01T00:00:00.000Z",
  createdAt: "2026-10-18T00:00:00.000Z",
  updatedAt: "2026-10-18T00:00:00.000Z",
};
export const conversation = {
  id: fixtureId(600),
  proposalId: proposal.id,
  learningRequestId: proposal.learningRequestId,
  participantAId: proposerId,
  participantBId: recipientId,
  createdAt: proposal.createdAt,
};
