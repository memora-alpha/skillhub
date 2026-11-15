import { Injectable } from "@nestjs/common";
import type {
  LearningPathStatus,
  Prisma,
} from "../../../../generated/prisma/client";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  ADMIN_PATH_DETAIL_INCLUDE,
  ADMIN_PATH_LIST_INCLUDE,
  AdminLearningPathReaderPort,
} from "../ports/admin-learning-path.reader";
import { learningStage } from "./path-overview.projection";

@Injectable()
export class AdminLearningPathSourceReader extends AdminLearningPathReaderPort {
  terminationWork(
    tx: TransactionContext,
    page: { receivedAt?: Date; order: "asc" | "desc"; take: number },
  ) {
    return tx.learningChangeRequest.findMany({
      where: {
        kind: "PATH_TERMINATION",
        status: { in: ["PENDING", "STAFF_REVIEW"] },
        ...(page.receivedAt
          ? {
              createdAt:
                page.order === "desc"
                  ? { lte: page.receivedAt }
                  : { gte: page.receivedAt },
            }
          : {}),
      },
      orderBy: [{ createdAt: page.order }, { id: "asc" }],
      take: page.take,
      select: {
        id: true,
        pathId: true,
        status: true,
        reason: true,
        resolvedByUserId: true,
        requesterId: true,
        createdAt: true,
        expiresAt: true,
        version: true,
      },
    });
  }

  terminationDetail(tx: TransactionContext, id: string) {
    return tx.learningChangeRequest.findUnique({
      where: { id },
      select: {
        id: true,
        pathId: true,
        status: true,
        reason: true,
        resolvedByUserId: true,
        requesterId: true,
        createdAt: true,
        expiresAt: true,
        version: true,
      },
    });
  }

  list(
    tx: TransactionContext,
    input: {
      status?: LearningPathStatus;
      participantId?: string;
      q?: string;
      cursor?: { updatedAt: Date; id: string };
      take: number;
    },
  ) {
    const filters: Prisma.LearningPathWhereInput[] = [];
    if (input.participantId)
      filters.push({
        OR: [
          { participantAId: input.participantId },
          { participantBId: input.participantId },
        ],
      });
    if (input.q)
      filters.push({
        OR: [
          {
            participantAIdRecord: {
              fullName: { contains: input.q, mode: "insensitive" },
            },
          },
          {
            participantBIdRecord: {
              fullName: { contains: input.q, mode: "insensitive" },
            },
          },
        ],
      });
    if (input.cursor)
      filters.push({
        OR: [
          { updatedAt: { lt: input.cursor.updatedAt } },
          { updatedAt: input.cursor.updatedAt, id: { lt: input.cursor.id } },
        ],
      });
    return tx.learningPath.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
        ...(filters.length ? { AND: filters } : {}),
      },
      include: ADMIN_PATH_LIST_INCLUDE,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: input.take,
    });
  }

  detail(tx: TransactionContext, pathId: string) {
    return tx.learningPath.findUnique({
      where: { id: pathId },
      include: ADMIN_PATH_DETAIL_INCLUDE,
    });
  }

  async summary(tx: TransactionContext, window: { from: Date; to: Date }) {
    const [attendance, paths, scheduled] = await Promise.all([
      tx.sessionAttendanceInterval.findMany({
        where: {
          joinedAt: { lt: window.to },
          OR: [{ leftAt: null }, { leftAt: { gt: window.from } }],
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
      tx.learningPath.findMany({
        where: { lockedVersion: { not: null }, status: { not: "CANCELLED" } },
        select: {
          id: true,
          status: true,
          lockedVersion: true,
          settledAt: true,
          terminationApprovedAt: true,
        },
      }),
      this.scheduledSessions(tx, window),
    ]);
    const pathSessions = paths.length
      ? await tx.session.findMany({
          where: { pathId: { in: paths.map((path) => path.id) } },
          select: {
            pathId: true,
            status: true,
            teacherFirstJoinedAt: true,
            learnerFirstJoinedAt: true,
          },
        })
      : [];
    const sessionsByPath = new Map<string, typeof pathSessions>();
    for (const session of pathSessions) {
      const rows = sessionsByPath.get(session.pathId) ?? [];
      rows.push(session);
      sessionsByPath.set(session.pathId, rows);
    }
    return {
      activeLearningUsers: attendance.length,
      inProgressPaths: paths.filter(
        (path) =>
          learningStage(path, sessionsByPath.get(path.id) ?? []) === "LEARNING",
      ).length,
      scheduledSessions: scheduled.length,
      completedInScheduledCohort: scheduled.filter(
        (row) => row.status === "COMPLETED",
      ).length,
    };
  }

  scheduledSessions(tx: TransactionContext, window: { from: Date; to: Date }) {
    return tx.session.findMany({
      where: { startAt: { gte: window.from, lt: window.to } },
      select: { startAt: true, status: true },
    });
  }

  async topSkills(tx: TransactionContext, window: { from: Date; to: Date }) {
    const rows = await tx.$queryRaw<
      { skillId: string; name: string; completedSessions: bigint }[]
    >`SELECT v.skill_id AS "skillId", s.name, COUNT(*)::bigint AS "completedSessions"
      FROM sessions x
      JOIN learning_plan_versions v ON v.plan_id=x.plan_id AND v.version_no=x.plan_version
      JOIN skills s ON s.skill_id=v.skill_id
      WHERE x.status='COMPLETED' AND x.start_at >= ${window.from} AND x.start_at < ${window.to}
      GROUP BY v.skill_id, s.name
      ORDER BY COUNT(*) DESC, s.name, v.skill_id
      LIMIT 10`;
    return rows.map((row) => ({
      skillId: row.skillId,
      name: row.name,
      completedSessions: Number(row.completedSessions),
    }));
  }
}
