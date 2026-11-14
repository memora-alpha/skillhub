import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { formatCredit } from "../../../credit/domain/money";
import { learningStage } from "../../../learning-paths/application/services/path-overview.projection";
import {
  adminDayBuckets,
  adminReportingWindow,
  type AdminReportingWindow,
} from "../../domain/admin-reporting-window";
import { available, unavailable } from "../contracts/admin-operation.views";

@Injectable()
export class AdminDashboardReader {
  constructor(private readonly db: PrismaService) {}

  async summary(input: { from: string; to: string; timezone?: string }) {
    const window = adminReportingWindow(input);
    const asOf = await this.databaseNow();
    const [users, learning, finance, work, topSkills] = await Promise.all([
      this.section("DASHBOARD_USERS_UNAVAILABLE", () => this.users(window)),
      this.section("DASHBOARD_LEARNING_UNAVAILABLE", () =>
        this.learning(window),
      ),
      this.section("DASHBOARD_FINANCE_UNAVAILABLE", () => this.finance(window)),
      this.section("DASHBOARD_WORK_UNAVAILABLE", () => this.work()),
      this.section("DASHBOARD_SKILLS_UNAVAILABLE", () =>
        this.topSkills(window),
      ),
    ]);
    return {
      asOf,
      from: window.from,
      to: window.to,
      timezone: window.timezone,
      users,
      learning,
      finance,
      work,
      topSkills,
    };
  }

  async trends(input: {
    from: string;
    to: string;
    timezone?: string;
    granularity?: "day";
  }) {
    const window = adminReportingWindow(input);
    const asOf = await this.databaseNow();
    const buckets = adminDayBuckets(window);
    const section = await this.section(
      "DASHBOARD_TRENDS_UNAVAILABLE",
      async () => {
        const [users, sessions, transactions] = await Promise.all([
          this.db.user.findMany({
            where: {
              roleIdRecord: { code: "USER" },
              createdAt: { gte: window.from, lt: window.to },
            },
            select: { createdAt: true },
          }),
          this.db.session.findMany({
            where: { startAt: { gte: window.from, lt: window.to } },
            select: { startAt: true, status: true },
          }),
          this.db.creditTransaction.findMany({
            where: {
              type: "TOP_UP",
              status: "SUCCESS",
              createdAt: { gte: window.from, lt: window.to },
            },
            select: { createdAt: true, amount: true },
          }),
        ]);
        return buckets.map((bucket) => ({
          ...bucket,
          newUsers: users.filter((row) => inBucket(row.createdAt, bucket))
            .length,
          scheduledSessions: sessions.filter((row) =>
            inBucket(row.startAt, bucket),
          ).length,
          completedSessions: sessions.filter(
            (row) =>
              row.status === "COMPLETED" && inBucket(row.startAt, bucket),
          ).length,
          topUpCredit: formatCredit(
            transactions
              .filter((row) => inBucket(row.createdAt, bucket))
              .reduce((total, row) => total + row.amount, 0n),
          ),
        }));
      },
    );
    return {
      asOf,
      from: window.from,
      to: window.to,
      timezone: window.timezone,
      granularity: "day",
      buckets: section,
    };
  }

  private async users(window: AdminReportingWindow) {
    const [total, created, statuses] = await Promise.all([
      this.db.user.count({ where: { roleIdRecord: { code: "USER" } } }),
      this.db.user.count({
        where: {
          roleIdRecord: { code: "USER" },
          createdAt: { gte: window.from, lt: window.to },
        },
      }),
      this.db.user.groupBy({
        by: ["accountStatus"],
        where: { roleIdRecord: { code: "USER" } },
        _count: { _all: true },
      }),
    ]);
    return {
      totalUsers: total,
      newUsers: created,
      statusBreakdown: Object.fromEntries(
        statuses.map((row) => [row.accountStatus, row._count._all]),
      ),
    };
  }

  private async learning(window: AdminReportingWindow) {
    const [attendance, paths, sessions] = await Promise.all([
      this.db.sessionAttendanceInterval.findMany({
        where: {
          joinedAt: { lt: window.to },
          OR: [{ leftAt: null }, { leftAt: { gt: window.from } }],
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
      this.db.learningPath.findMany({
        where: { lockedVersion: { not: null }, status: { not: "CANCELLED" } },
        select: {
          id: true,
          status: true,
          lockedVersion: true,
          settledAt: true,
          terminationApprovedAt: true,
        },
      }),
      this.db.session.findMany({
        where: { startAt: { gte: window.from, lt: window.to } },
        select: {
          pathId: true,
          status: true,
          teacherFirstJoinedAt: true,
          learnerFirstJoinedAt: true,
        },
      }),
    ]);
    const stageSessions = paths.length
      ? await this.db.session.findMany({
          where: { pathId: { in: paths.map((path) => path.id) } },
          select: {
            pathId: true,
            status: true,
            teacherFirstJoinedAt: true,
            learnerFirstJoinedAt: true,
          },
        })
      : [];
    const sessionsByPath = new Map<string, typeof stageSessions>();
    for (const session of stageSessions) {
      const existing = sessionsByPath.get(session.pathId) ?? [];
      existing.push(session);
      sessionsByPath.set(session.pathId, existing);
    }
    return {
      activeLearningUsers: attendance.length,
      inProgressPaths: paths.filter(
        (path) =>
          learningStage(path, sessionsByPath.get(path.id) ?? []) === "LEARNING",
      ).length,
      scheduledSessions: sessions.length,
      completedInScheduledCohort: sessions.filter(
        (row) => row.status === "COMPLETED",
      ).length,
    };
  }

  private async finance(window: AdminReportingWindow) {
    const [topUp, held, feeRows] = await Promise.all([
      this.db.creditTransaction.aggregate({
        where: {
          type: "TOP_UP",
          status: "SUCCESS",
          createdAt: { gte: window.from, lt: window.to },
        },
        _sum: { amount: true },
      }),
      this.db.creditWallet.aggregate({ _sum: { heldCredit: true } }),
      this.db.$queryRaw<{ collected: bigint; refunded: bigint }[]>`
        WITH collected AS (
          SELECT COALESCE(SUM(t.amount),0)::bigint AS amount
          FROM credit_transactions t JOIN credit_operations o ON o.operation_id=t.operation_id
          WHERE t.type='PLATFORM_FEE' AND t.status='SUCCESS' AND o.status='SUCCESS'
            AND t.created_at >= ${window.from} AND t.created_at < ${window.to}
        ), refunded AS (
          SELECT COALESCE(SUM(t.available_delta),0)::bigint AS amount
          FROM credit_operations o JOIN credit_transactions t ON t.operation_id=o.operation_id
          WHERE o.operation_type='MATERIAL_REFUND' AND o.status='SUCCESS' AND t.status='SUCCESS'
            AND o.created_at >= ${window.from} AND o.created_at < ${window.to}
        ) SELECT collected.amount AS collected, refunded.amount AS refunded FROM collected, refunded`,
    ]);
    const fees = feeRows[0] ?? { collected: 0n, refunded: 0n };
    return {
      topUpCredit: formatCredit(topUp._sum.amount ?? 0n),
      heldCredit: formatCredit(held._sum.heldCredit ?? 0n),
      fees: {
        basis: "RECORDED_CREDIT_FEES_AND_MATERIAL_REFUNDS",
        collectedCredit: formatCredit(fees.collected),
        refundedCredit: formatCredit(fees.refunded),
        netCredit: formatCredit(fees.collected - fees.refunded),
      },
    };
  }

  private async work() {
    const [payments, cases, incidents, verifications, tags] = await Promise.all(
      [
        this.db.payment.count({ where: { status: "REVIEW" } }),
        this.db.reportCase.count({ where: { status: { not: "RESOLVED" } } }),
        this.db.reportIncident.count({ where: { status: "OPEN" } }),
        this.db.skillVerification.count({ where: { status: "PENDING" } }),
        this.db.tagCreationRequest.count({ where: { status: "PENDING" } }),
      ],
    );
    return {
      payments,
      reportCases: cases,
      reportIncidents: incidents,
      verifications,
      tagRequests: tags,
    };
  }

  private async topSkills(window: AdminReportingWindow) {
    const rows = await this.db.$queryRaw<
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

  private async databaseNow() {
    const [row] = await this.db.$queryRaw<
      { now: Date }[]
    >`SELECT CURRENT_TIMESTAMP AS now`;
    if (!(row?.now instanceof Date))
      throw new Error("DATABASE_TIME_UNAVAILABLE");
    return row.now;
  }

  private async section<T>(code: string, read: () => Promise<T>) {
    try {
      return available(await read());
    } catch {
      return unavailable(code);
    }
  }
}

function inBucket(value: Date, bucket: { fromUtc: Date; toUtc: Date }) {
  return value >= bucket.fromUtc && value < bucket.toUtc;
}
