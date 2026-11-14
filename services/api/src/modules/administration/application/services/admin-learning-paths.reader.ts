import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  LearningPathStatus,
  Prisma,
} from "../../../../generated/prisma/client";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import {
  listBoundary,
  listInput,
  listResult,
} from "../../../../shared/http/list-page";
import { auditContext } from "../../../materials/application/services/material-support";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { learningStage } from "../../../learning-paths/application/services/path-overview.projection";

const adminPathDetailInclude = {
  participantAIdRecord: { select: { id: true, fullName: true } },
  participantBIdRecord: { select: { id: true, fullName: true } },
  learningPathVersionPathIdRecords: {
    orderBy: { versionNo: "desc" as const },
    select: {
      versionNo: true,
      exchangeType: true,
      totalCreditPerUser: true,
      negotiatedCredit: true,
      teacherId: true,
      learnerId: true,
      createdAt: true,
      pathVersionPlanPathVersionRecords: {
        select: {
          planId: true,
          planVersion: true,
          planVersionRecord: {
            select: {
              skillId: true,
              learningGoal: true,
              totalSessions: true,
              skillIdRecord: { select: { name: true } },
            },
          },
        },
      },
    },
  },
  learningPlanPathIdRecords: {
    select: {
      id: true,
      sessionOwnedPlanRecords: {
        orderBy: [{ startAt: "asc" as const }, { id: "asc" as const }],
        select: {
          id: true,
          planId: true,
          planVersion: true,
          outlineSessionNo: true,
          teacherId: true,
          learnerId: true,
          startAt: true,
          endAt: true,
          status: true,
          teacherFirstJoinedAt: true,
          learnerFirstJoinedAt: true,
          teacherAttendanceSeconds: true,
          learnerAttendanceSeconds: true,
          attendanceOutcomes: {
            select: {
              status: true,
              attendanceCase: true,
              resolution: true,
              occurrenceStartAt: true,
            },
          },
        },
      },
    },
  },
  reportCaseRelatedPathIdRecords: {
    select: {
      id: true,
      status: true,
      severity: true,
      reasonCode: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
  },
  changeRequests: {
    where: { kind: "PATH_TERMINATION" },
    select: {
      id: true,
      status: true,
      version: true,
      createdAt: true,
      closedAt: true,
    },
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
  },
  settlementAttempt: {
    select: {
      checkedAt: true,
      attemptCount: true,
      outcome: true,
      errorCode: true,
    },
  },
} satisfies Prisma.LearningPathInclude;

type AdminPathDetail = Prisma.LearningPathGetPayload<{
  include: typeof adminPathDetailInclude;
}>;

@Injectable()
export class AdminLearningPathsReader {
  constructor(
    private readonly db: PrismaService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
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
    const filters: Prisma.LearningPathWhereInput[] = [];
    if (query.participantId)
      filters.push({
        OR: [
          { participantAId: query.participantId },
          { participantBId: query.participantId },
        ],
      });
    if (query.q?.trim())
      filters.push({
        OR: [
          {
            participantAIdRecord: {
              fullName: { contains: query.q.trim(), mode: "insensitive" },
            },
          },
          {
            participantBIdRecord: {
              fullName: { contains: query.q.trim(), mode: "insensitive" },
            },
          },
        ],
      });
    const boundary = listBoundary("updatedAt", cursor) as {
      AND?: Prisma.LearningPathWhereInput[];
    };
    const where: Prisma.LearningPathWhereInput = {
      ...(query.status ? { status: query.status as LearningPathStatus } : {}),
      ...(filters.length || boundary.AND?.length
        ? { AND: [...filters, ...(boundary.AND ?? [])] }
        : {}),
    };
    const rows = await this.db.learningPath.findMany({
      where,
      include: {
        participantAIdRecord: { select: { id: true, fullName: true } },
        participantBIdRecord: { select: { id: true, fullName: true } },
        learningPlanPathIdRecords: {
          select: {
            sessionOwnedPlanRecords: {
              select: {
                status: true,
                teacherFirstJoinedAt: true,
                learnerFirstJoinedAt: true,
              },
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
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
      const path = await tx.learningPath.findUnique({
        where: { id: pathId },
        include: adminPathDetailInclude,
      });
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

function safePathDetail(path: AdminPathDetail) {
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
