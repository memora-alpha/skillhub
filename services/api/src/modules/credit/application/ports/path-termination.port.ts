import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

export type HeldTerminationAllocation = {
  allocationId: string;
  refund: bigint;
  counterpartyPayment: bigint;
  platformFee: bigint;
};
export type PathTerminationInstruction = {
  pathId: string;
  pathVersion: number;
  requestId: string;
  policyReference: string;
  participantAId: string;
  participantBId: string;
  exchangeType: "ONE_WAY" | "TWO_WAY";
  expectedCredit: bigint;
  teacherId: string | null;
  learnerId: string | null;
  allocations: HeldTerminationAllocation[];
  now: Date;
};
export type TerminationQuoteContext = Omit<
  PathTerminationInstruction,
  "allocations" | "requestId" | "policyReference"
>;
export type TerminationQuote = {
  policy: string;
  status: "BLOCKED" | "READY";
  reasonCodes: string[];
  totalSessions: number;
  completedSessions: number;
  unresolvedSessionIds: string[];
  directions: {
    planId: string;
    teacherId: string;
    learnerId: string;
    total: number;
    completed: number;
  }[];
  allocations: {
    allocationId: string;
    userId: string;
    remainingHeld: string;
    completedCredit: string;
    uncompletedCredit: string;
    refund: string;
    counterpartyPayment: string;
    platformFee: string;
    sessionCredits: {
      sessionId: string;
      planId: string;
      teacherId: string;
      learnerId: string;
      credit: string;
      status: string;
    }[];
  }[];
};

/** Approved case instruction only; caller owns live permissions, Path lock, audit and policy gate. */
export abstract class PathTerminationPort {
  abstract previewHeld(
    tx: TransactionContext,
    input: TerminationQuoteContext,
  ): Promise<TerminationQuote>;
  abstract distributeHeld(
    tx: TransactionContext,
    instruction: PathTerminationInstruction,
  ): Promise<{ operationId: string }>;
}
