import type { OutboxMessage } from "../../../../infrastructure/events/outbox.types";

export type LearningRequestRejectionPayload = {
  requestId: string;
  ownerId: string;
  reviewedVersion: number;
  decisionVersion: number;
  rejectReason: string;
};

export type LearningRequestRejectedEvent = OutboxMessage & {
  type: "learning-request.rejected";
  version: 1;
  payload: LearningRequestRejectionPayload;
};
