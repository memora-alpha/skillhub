import { Injectable, NotFoundException } from "@nestjs/common";
import type { LearningPath } from "../../../../generated/prisma/client";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { ParticipantCasesReader } from "../../../reports/application/services/participant-cases.reader";
import { SessionOverviewReader } from "../../../learning-sessions/application/services/session-overview.reader";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import { databaseNow } from "../../../learning-sessions/application/services/session-tx";
import {
  assertPathParticipant,
  OPEN_CHANGE_STATUSES,
} from "./learning-change-state";

import { projectOverview } from "./path-overview.projection";
export {
  learningStage,
  sortAttention,
  type Attention,
} from "./path-overview.projection";
@Injectable()
export class PathOverviewReader {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly sessions: SessionOverviewReader,
    private readonly cases: ParticipantCasesReader,
    private readonly configuration: SystemConfigurationService,
  ) {}
  async batch(tx: TransactionContext, actor: Principal, paths: LearningPath[]) {
    const ids = paths.map((path) => path.id);
    for (const path of paths) assertPathParticipant(actor, path);
    if (!ids.length)
      return new Map<string, ReturnType<typeof projectOverview>>();
    const now = await databaseNow(tx);
    const [sessionRows, cases, changes, attempts, plans] = await Promise.all([
      this.sessions.batch(tx, ids),
      this.cases.batch(tx, actor.userId, ids),
      tx.learningChangeRequest.findMany({
        where: {
          pathId: { in: ids },
          status: { in: OPEN_CHANGE_STATUSES },
          OR: [{ expiresAt: { gt: now } }, { approvedAt: { not: null } }],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      tx.pathSettlementAttempt.findMany({ where: { pathId: { in: ids } } }),
      tx.pathVersionPlan.findMany({
        where: { pathId: { in: ids } },
        include: { ownedPlanRecord: true, planVersionRecord: true },
      }),
    ]);
    const needsDeadline = paths.some(
      (path) =>
        !path.settledAt &&
        path.lockedVersion &&
        sessionRows.some((row) => row.session.pathId === path.id) &&
        sessionRows
          .filter((row) => row.session.pathId === path.id)
          .every((row) => row.session.status === "COMPLETED"),
    );
    const hours = needsDeadline
      ? (await this.configuration.getSnapshot(["session.attendancePolicy"], tx))
          .values["session.attendancePolicy"]?.disputeWindowHours
      : undefined;
    const entries = paths.map((path) => {
      const links = plans.filter(
        (row) =>
          row.pathId === path.id &&
          row.pathVersion === (path.lockedVersion ?? path.currentVersion),
      );
      const sessions = sessionRows.filter(
        (row) =>
          row.session.pathId === path.id &&
          links.some(
            (link) =>
              link.planId === row.session.planId &&
              link.planVersion === row.session.planVersion,
          ),
      );
      return [
        path.id,
        projectOverview({
          actor,
          path,
          now,
          rows: sessions,
          cases: cases.filter((row) => row.relatedPathId === path.id),
          changes: changes.filter((row) => row.pathId === path.id),
          attempt: attempts.find((row) => row.pathId === path.id),
          plans: links,
          disputeHours: hours,
        }),
      ] as const;
    });
    return new Map(entries);
  }
  read(actor: Principal, pathId: string) {
    return this.transactions.run(async (tx) => {
      const path = await tx.learningPath.findUnique({ where: { id: pathId } });
      if (!path) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
      return (await this.batch(tx, actor, [path])).get(pathId)!;
    });
  }
}

export function overviewCard(
  view: Awaited<ReturnType<PathOverviewReader["read"]>>,
) {
  return {
    evaluatedAt: view.evaluatedAt,
    learningStage: view.learningStage,
    stageReasonCode: view.stageReasonCode,
    progress: view.progress,
    nextSession: view.nextSession,
    attentionCount: view.attentionCount,
    primaryAttention: view.primaryAttention,
    primaryAction: view.primaryAction,
    settlement: view.settlement,
  };
}
