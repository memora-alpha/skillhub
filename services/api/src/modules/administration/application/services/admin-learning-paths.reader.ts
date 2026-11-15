import { Injectable, NotFoundException } from "@nestjs/common";
import type { LearningPathStatus } from "../../../../generated/prisma/client";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import { listInput, listResult } from "../../../../shared/http/list-page";
import { auditContext } from "../../../materials/application/services/material-support";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { learningStage } from "../../../learning-paths/application/services/path-overview.projection";
import {
  AdminLearningPathReaderPort,
  type AdminPathDetailRecord,
} from "../../../learning-paths/application/ports/admin-learning-path.reader";

@Injectable()
export class AdminLearningPathsReader {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly paths: AdminLearningPathReaderPort,
  ) {}

  async list(query: {
    limit?: number;
    cursor?: string;
    status?: string;
    participantId?: string;
    q?: string;
  }) {
    const scope = JSON.stringify([
      "admin-learning-paths-v1",
      query.status ?? null,
      query.participantId ?? null,
      query.q?.trim().toLowerCase() ?? null,
    ]);
    const { limit, cursor } = listInput(query, scope);
    const rows = await this.transactions.run((tx) =>
      this.paths.list(tx, {
        ...(query.status ? { status: query.status as LearningPathStatus } : {}),
        ...(query.participantId ? { participantId: query.participantId } : {}),
        ...(query.q?.trim() ? { q: query.q.trim() } : {}),
        ...(cursor
          ? {
              cursor: {
                updatedAt: new Date(cursor.value),
                id: cursor.id,
              },
            }
          : {}),
        take: limit + 1,
      }),
    );
    const page = listResult(rows, limit, scope, (row) => row.updatedAt);
    return {
      ...page,
      data: page.data.map((row) => ({
        id: row.id,
        status: row.status,
        learningStage: learningStage(
          row,
          row.learningPlanPathIdRecords.flatMap(
            (plan) => plan.sessionOwnedPlanRecords,
          ),
        ),
        currentVersion: row.currentVersion,
        lockedVersion: row.lockedVersion,
        participantA: row.participantAIdRecord,
        participantB: row.participantBIdRecord,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        completedAt: row.completedAt,
      })),
    };
  }

  detail(principal: Principal, pathId: string) {
    return this.transactions.run(async (tx) => {
      const path = await this.paths.detail(tx, pathId);
      if (!path) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
      await this.audit.append(tx, {
        actor: {
          kind: "HUMAN",
          userId: principal.userId,
          roles: principal.roles as ("USER" | "STAFF" | "ADMIN")[],
        },
        action: "ADMIN_LEARNING_PATH_READ",
        target: { type: "LEARNING_PATH", id: path.id },
        after: { kind: "LEARNING_PATH", id: path.id },
        reason: "Admin learning path detail read",
        context: auditContext(),
      });
      return safePathDetail(path);
    });
  }
}

function safePathDetail(path: AdminPathDetailRecord) {
  return {
    id: path.id,
    status: path.status,
    currentVersion: path.currentVersion,
    lockedVersion: path.lockedVersion,
    participants: [path.participantAIdRecord, path.participantBIdRecord],
    versions: path.learningPathVersionPathIdRecords.map((version) => ({
      ...version,
      totalCreditPerUser: version.totalCreditPerUser?.toString() ?? null,
      negotiatedCredit: version.negotiatedCredit?.toString() ?? null,
    })),
    sessions: path.learningPlanPathIdRecords.flatMap((plan) =>
      plan.sessionOwnedPlanRecords.map((session) => ({
        ...session,
        teacherAttendanceSeconds: session.teacherAttendanceSeconds.toString(),
        learnerAttendanceSeconds: session.learnerAttendanceSeconds.toString(),
      })),
    ),
    settlement: {
      settledPathVersion: path.settledPathVersion,
      exchangeType: path.settlementExchangeType,
      grossCredit: path.settlementGrossAmount?.toString() ?? null,
      feeCredit: path.settlementFeeAmount?.toString() ?? null,
      settledAt: path.settledAt,
      attempt: path.settlementAttempt,
    },
    reports: path.reportCaseRelatedPathIdRecords,
    terminations: path.changeRequests,
    createdAt: path.createdAt,
    updatedAt: path.updatedAt,
    completedAt: path.completedAt,
  };
}
