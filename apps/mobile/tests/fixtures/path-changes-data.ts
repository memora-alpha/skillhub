import type {
  TerminationRequest,
  SettlementStatus,
} from "../../src/features/learning-paths/api/path-changes-contract";
import { fixtureId } from "./learning-requests-data";

export function terminationFixture(
  overrides: Partial<TerminationRequest> = {},
): TerminationRequest {
  return {
    id: fixtureId(30),
    pathId: fixtureId(10),
    sessionId: null,
    kind: "PATH_TERMINATION",
    status: "PENDING",
    version: 1,
    requesterId: fixtureId(1),
    reason: "Không thể tiếp tục học",
    createdAt: "2030-01-01T00:00:00Z",
    expiresAt: "2030-01-08T00:00:00Z",
    responderId: null,
    respondedAt: null,
    accepted: null,
    responseNote: null,
    closedAt: null,
    operationId: null,
    resolution: null,
    blockedByDispute: false,
    awaitingPolicy: true,
    ...overrides,
  };
}
export function settlementFixture(
  status: SettlementStatus["status"] = "WAITING_TERMINATION",
): SettlementStatus {
  return {
    pathId: fixtureId(10),
    status,
    reasonCode: null,
    nextAction: "VIEW_TERMINATION_REQUEST",
    settledAt: null,
    lastCheckedAt: null,
    attemptCount: 0,
    retryable: false,
  };
}
