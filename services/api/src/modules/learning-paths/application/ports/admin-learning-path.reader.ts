import type { AdminWorkSourcePage } from "../../../administration/application/contracts/admin-work-source-page";
import type {
  LearningPathStatus,
  Prisma,
} from "../../../../generated/prisma/client";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

export const ADMIN_PATH_LIST_INCLUDE = {
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
} satisfies Prisma.LearningPathInclude;

export const ADMIN_PATH_DETAIL_INCLUDE = {
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

export type AdminPathListRecord = Prisma.LearningPathGetPayload<{
  include: typeof ADMIN_PATH_LIST_INCLUDE;
}>;

export type AdminPathDetailRecord = Prisma.LearningPathGetPayload<{
  include: typeof ADMIN_PATH_DETAIL_INCLUDE;
}>;

export type AdminTerminationWorkRow = {
  id: string;
  pathId: string;
  status: string;
  reason: string;
  resolvedByUserId: string | null;
  requesterId: string;
  createdAt: Date;
  expiresAt: Date;
  version: number;
};

export abstract class AdminLearningPathReaderPort {
  abstract terminationWork(
    tx: TransactionContext,
    page: AdminWorkSourcePage,
  ): Promise<AdminTerminationWorkRow[]>;

  abstract terminationDetail(
    tx: TransactionContext,
    id: string,
  ): Promise<AdminTerminationWorkRow | null>;

  abstract list(
    tx: TransactionContext,
    input: {
      status?: LearningPathStatus;
      participantId?: string;
      q?: string;
      cursor?: { updatedAt: Date; id: string };
      take: number;
    },
  ): Promise<AdminPathListRecord[]>;

  abstract detail(
    tx: TransactionContext,
    pathId: string,
  ): Promise<AdminPathDetailRecord | null>;

  abstract summary(
    tx: TransactionContext,
    window: { from: Date; to: Date },
  ): Promise<{
    activeLearningUsers: number;
    inProgressPaths: number;
    scheduledSessions: number;
    completedInScheduledCohort: number;
  }>;

  abstract scheduledSessions(
    tx: TransactionContext,
    window: { from: Date; to: Date },
  ): Promise<{ startAt: Date; status: string }[]>;

  abstract topSkills(
    tx: TransactionContext,
    window: { from: Date; to: Date },
  ): Promise<{ skillId: string; name: string; completedSessions: number }[]>;
}
