import { Injectable } from "@nestjs/common";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import { AdminCreditReaderPort } from "../../../credit/application/ports/admin-credit.reader";
import { formatCredit } from "../../../credit/domain/money";
import { AdminLearningPathReaderPort } from "../../../learning-paths/application/ports/admin-learning-path.reader";
import { AdminPaymentReaderPort } from "../../../payments/application/ports/admin-payment.reader";
import { AdminReportReaderPort } from "../../../reports/application/ports/admin-report.reader";
import { AdminTagRequestReaderPort } from "../../../skills/application/ports/admin-tag-request.reader";
import { AdminUserMetricsReaderPort } from "../../../users/application/ports/admin-user-metrics.reader";
import { AdminVerificationReaderPort } from "../../../verifications/application/ports/admin-verification.reader";
import {
  adminDayBuckets,
  adminReportingWindow,
} from "../../domain/admin-reporting-window";
import { available, unavailable } from "../contracts/admin-operation.views";

@Injectable()
export class AdminDashboardReader {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly users: AdminUserMetricsReaderPort,
    private readonly learningPaths: AdminLearningPathReaderPort,
    private readonly credit: AdminCreditReaderPort,
    private readonly payments: AdminPaymentReaderPort,
    private readonly reports: AdminReportReaderPort,
    private readonly verifications: AdminVerificationReaderPort,
    private readonly tags: AdminTagRequestReaderPort,
  ) {}

  async summary(input: { from: string; to: string; timezone?: string }) {
    const window = adminReportingWindow(input);
    const asOf = await this.databaseNow();
    const [users, learning, finance, work, topSkills] = await Promise.all([
      this.section("DASHBOARD_USERS_UNAVAILABLE", () =>
        this.transactions.run((tx) => this.users.summary(tx, window)),
      ),
      this.section("DASHBOARD_LEARNING_UNAVAILABLE", () =>
        this.transactions.run((tx) => this.learningPaths.summary(tx, window)),
      ),
      this.section("DASHBOARD_FINANCE_UNAVAILABLE", () =>
        this.transactions.run(async (tx) => {
          const result = await this.credit.summary(tx, window);
          return {
            topUpCredit: formatCredit(result.topUpCredit),
            heldCredit: formatCredit(result.heldCredit),
            fees: {
              basis: "RECORDED_CREDIT_FEES_AND_MATERIAL_REFUNDS",
              collectedCredit: formatCredit(result.collectedCredit),
              refundedCredit: formatCredit(result.refundedCredit),
              netCredit: formatCredit(
                result.collectedCredit - result.refundedCredit,
              ),
            },
          };
        }),
      ),
      this.section("DASHBOARD_WORK_UNAVAILABLE", () =>
        this.transactions.run(async (tx) => {
          const [payments, reports, verifications, tags] = await Promise.all([
            this.payments.reviewCount(tx),
            this.reports.openCounts(tx),
            this.verifications.pendingCount(tx),
            this.tags.pendingCount(tx),
          ]);
          return {
            payments,
            reportCases: reports.cases,
            reportIncidents: reports.incidents,
            verifications,
            tagRequests: tags,
          };
        }),
      ),
      this.section("DASHBOARD_SKILLS_UNAVAILABLE", () =>
        this.transactions.run((tx) => this.learningPaths.topSkills(tx, window)),
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
    const section = await this.section("DASHBOARD_TRENDS_UNAVAILABLE", () =>
      this.transactions.run(async (tx) => {
        const [users, sessions, transactions] = await Promise.all([
          this.users.createdAt(tx, window),
          this.learningPaths.scheduledSessions(tx, window),
          this.credit.topUps(tx, window),
        ]);
        return buckets.map((bucket) => ({
          ...bucket,
          newUsers: users.filter((createdAt) => inBucket(createdAt, bucket))
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
      }),
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

  private databaseNow() {
    return this.transactions.run(async (tx) => {
      const [row] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      if (!(row?.now instanceof Date))
        throw new Error("DATABASE_TIME_UNAVAILABLE");
      return row.now;
    });
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
