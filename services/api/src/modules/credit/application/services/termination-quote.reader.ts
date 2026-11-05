import { ConflictException } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type {
  TerminationQuoteContext,
  TerminationQuote,
} from "../ports/path-termination.port";
import type {
  HeldCreditAllocation,
  Session,
} from "../../../../generated/prisma/client";
import {
  calculateSessionCredit,
  ONE_WAY_SESSION_POLICY,
  TWO_WAY_SESSION_POLICY,
  allocateHeldFee,
} from "../../domain/session-credit";
import { readSessionCreditState } from "./session-credit-state.reader";
import { formatCredit } from "../../domain/money";
import { byCodeUnit } from "../../../../infrastructure/idempotency/idempotency.service";

function allocationMatches(
  row: HeldCreditAllocation,
  input: TerminationQuoteContext,
) {
  if (
    row.status !== "ACTIVE" ||
    row.remainingHeld !== row.amount ||
    row.amount !== input.expectedCredit ||
    ![input.participantAId, input.participantBId].includes(row.userId)
  )
    return false;
  if (input.exchangeType === "ONE_WAY")
    return (
      row.userId === input.learnerId &&
      row.beneficiaryId === input.teacherId &&
      row.purpose === "TEACHING_PAYMENT"
    );
  return row.purpose === "COMMITMENT" && row.beneficiaryId === null;
}

function needsRuling(row: Session, now: Date) {
  if (row.status === "MAKEUP_REQUIRED")
    return row.makeupDeadlineAt !== null && row.makeupDeadlineAt <= now;
  if (["COMPLETED", "CANCELLED"].includes(row.status)) return false;
  return !["CONFIRMED", "READY"].includes(row.status) || row.startAt <= now;
}

export async function readTerminationQuote(
  tx: TransactionContext,
  input: TerminationQuoteContext,
): Promise<TerminationQuote> {
  const held = await tx.heldCreditAllocation.findMany({
    where: { pathId: input.pathId, lockedPathVersion: input.pathVersion },
    orderBy: { id: "asc" },
  });
  const sessions = await readSessionCreditState(tx, input.pathId);
  const oneWay = input.exchangeType === "ONE_WAY";
  const heldFees =
    !oneWay && held.length ? allocateHeldFee(held) : new Map<string, bigint>();
  const reasons = new Set<string>();
  const count = input.exchangeType === "TWO_WAY" ? 2 : 1;
  if (
    held.length !== count ||
    new Set(held.map((row) => row.userId)).size !== count ||
    input.expectedCredit <= 0n ||
    held.some((row) => !allocationMatches(row, input))
  )
    reasons.add("TERMINATION_ALLOCATION_MISMATCH");
  const unresolvedSessionIds = sessions
    .filter((row) => needsRuling(row, input.now))
    .map((row) => row.id);
  if (unresolvedSessionIds.length)
    reasons.add("TERMINATION_SESSION_RULING_REQUIRED");
  const completedSessions = sessions.filter(
    (row) => row.status === "COMPLETED",
  ).length;
  if (
    !input.terminationApproved &&
    sessions.length > 0 &&
    completedSessions === sessions.length
  )
    reasons.add("TERMINATION_USE_FINAL_SETTLEMENT");
  const allocations = held.flatMap((row) => {
    try {
      const calculation = calculateSessionCredit(
        row.sessionCreditSnapshot,
        row.amount,
        input,
        sessions,
      );
      const fee = oneWay ? calculation.platformFee : heldFees.get(row.userId)!;
      const availableForCompensation = row.amount - fee;
      let compensation = oneWay ? 0n : calculation.compensationCredit;
      if (compensation > availableForCompensation)
        compensation = availableForCompensation;
      if (
        !oneWay &&
        (row.sessionCreditSnapshot as { ownerId?: string })?.ownerId !==
          row.userId
      )
        throw new ConflictException("SESSION_CREDIT_SNAPSHOT_MISMATCH");
      return [
        {
          allocationId: row.id,
          userId: row.userId,
          remainingHeld: formatCredit(row.remainingHeld),
          completedCredit: formatCredit(calculation.completedCredit),
          uncompletedCredit: formatCredit(calculation.uncompletedCredit),
          refund: formatCredit(
            oneWay
              ? calculation.uncompletedCredit
              : row.amount - fee - compensation,
          ),
          counterpartyPayment: formatCredit(
            oneWay ? calculation.completedCredit - fee : compensation,
          ),
          platformFee: formatCredit(fee),
          compensationCredit: formatCredit(compensation),
          requestedCompensationCredit: formatCredit(
            oneWay ? 0n : calculation.compensationCredit,
          ),
          attendance: sessions.map((session) => ({
            sessionId: session.id,
            outcome: session.creditAttendance,
          })),
          sessionCredits: calculation.sessions.map((item) => ({
            sessionId: item.id,
            planId: item.planId,
            teacherId: item.teacherId,
            learnerId: item.learnerId,
            credit: formatCredit(BigInt(item.creditUnits)),
            status: item.status,
          })),
        },
      ];
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      reasons.add(error.message);
      return [];
    }
  });
  const planIds = [...new Set(sessions.map((row) => row.planId))].sort(
    byCodeUnit,
  );
  const directions = planIds.map((planId) => {
    const rows = sessions.filter((row) => row.planId === planId);
    return {
      planId,
      teacherId: rows[0]!.teacherId,
      learnerId: rows[0]!.learnerId,
      total: rows.length,
      completed: rows.filter((row) => row.status === "COMPLETED").length,
    };
  });
  return {
    policy:
      input.exchangeType === "TWO_WAY"
        ? TWO_WAY_SESSION_POLICY
        : ONE_WAY_SESSION_POLICY,
    status: reasons.size ? "BLOCKED" : "READY",
    reasonCodes: [...reasons],
    totalSessions: sessions.length,
    completedSessions,
    unresolvedSessionIds,
    directions,
    allocations,
  };
}
