import { ConflictException, Injectable } from "@nestjs/common";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { ReportsService } from "../../../reports/application/services/reports.service";
import { databaseNow } from "../../../learning-sessions/application/services/session-tx";
import { lockLearningPath } from "./learning-path-lock";
import {
  assertPathParticipant,
  changeBlockedByDispute,
  pendingTermination,
} from "./learning-change-state";

@Injectable()
export class PathSettlementStatusService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly reports: ReportsService,
  ) {}
  read(actor: Principal, pathId: string) {
    return this.transactions.run(async (tx) => {
      await lockLearningPath(tx, pathId);
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: pathId },
      });
      assertPathParticipant(actor, path);
      const now = await databaseNow(tx);
      const attempt = await tx.pathSettlementAttempt.findUnique({
        where: { pathId },
      });
      const response = (
        status: string,
        reasonCode: string | null,
        nextAction: string,
      ) => ({
        pathId,
        status,
        reasonCode,
        nextAction,
        settledAt: path.settledAt,
        lastCheckedAt: attempt?.checkedAt ?? null,
        attemptCount: attempt?.attemptCount ?? 0,
        retryable: status === "RETRYING" || status === "READY",
      });
      if (path.settledAt)
        return response("SETTLED", null, "VIEW_WALLET_HISTORY");
      if (path.status === "CANCELLED")
        return response("TERMINATED", null, "VIEW_TERMINATION_DECISION");
      if (!path.lockedVersion)
        return response("NOT_LOCKED", null, "COMPLETE_AGREEMENT");
      if (await pendingTermination(tx, pathId, now))
        return response(
          "WAITING_TERMINATION",
          "SETTLEMENT_BLOCKED_BY_TERMINATION",
          "VIEW_TERMINATION_REQUEST",
        );
      if (await changeBlockedByDispute(tx, pathId))
        return response(
          "WAITING_DISPUTE",
          "SETTLEMENT_BLOCKED_BY_DISPUTE",
          "VIEW_REPORT_CASE",
        );
      const incomplete = await tx.session.count({
        where: { pathId, status: { not: "COMPLETED" } },
      });
      if (incomplete)
        return response(
          "WAITING_SESSIONS",
          "PATH_SESSIONS_INCOMPLETE",
          "COMPLETE_SESSIONS",
        );
      if (path.status !== "ACTIVE")
        return response(
          "NEEDS_REVIEW",
          "LEARNING_PATH_NOT_SETTLEABLE",
          "CONTACT_SUPPORT",
        );
      try {
        await this.reports.assertPathSettlementAllowed(tx, pathId, now);
      } catch (error) {
        if (
          error instanceof ConflictException &&
          error.message === "DISPUTE_WINDOW_OPEN"
        )
          return response("WAITING_DISPUTE_WINDOW", error.message, "WAIT");
        throw error;
      }
      if (attempt?.outcome === "NEEDS_REVIEW")
        return response("NEEDS_REVIEW", attempt.errorCode, "CONTACT_SUPPORT");
      if (attempt?.outcome === "RETRYING")
        return response("RETRYING", attempt.errorCode, "WAIT_FOR_RETRY");
      return response("READY", null, "WAIT_FOR_SETTLEMENT");
    });
  }
}
