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

/** Approved case instruction only; caller owns live permissions, Path lock, audit and policy gate. */
export abstract class PathTerminationPort {
  abstract distributeHeld(
    tx: TransactionContext,
    instruction: PathTerminationInstruction,
  ): Promise<{ operationId: string }>;
}
