import { BadRequestException, Injectable } from "@nestjs/common";
import type { Principal } from "../auth/application/services/sessions.service";
import { readDashboardLearning } from "../learning-paths/application/services/dashboard-learning.reader";
import { readDashboardUserGrowth } from "../users/application/dashboard-user.reader";
import type { AdminDashboardQuery } from "./admin-dashboard-query.dto";
import {
  dashboardQueuePermissions,
  readDashboardAttention,
} from "./dashboard-attention";
import { readDashboardFees, readDashboardFinance } from "./dashboard-finance";
import { dashboardPeriod } from "./dashboard-period";
import { DashboardSnapshot } from "./dashboard-snapshot";

export const overviewSections = [
  "kpis",
  "userGrowth",
  "learningActivity",
  "pathStages",
  "feeSeries",
  "attentionSummary",
  "priorityItems",
] as const;
export const learningSections = [
  "kpis",
  "learningActivity",
  "pathStages",
] as const;

function selectSections<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
) {
  const sections = value === undefined ? allowed : value.split(",");
  if (
    sections.some(
      (section) => !(allowed as readonly string[]).includes(section),
    )
  )
    throw new BadRequestException("INVALID_DASHBOARD_SECTION");
  return new Set(sections as readonly T[]);
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly snapshot: DashboardSnapshot) {}

  overview(actor: Principal, query: AdminDashboardQuery) {
    const period = dashboardPeriod(query);
    const sections = selectSections(query.sections, overviewSections);
    const kpis = sections.has("kpis");
    const activity = sections.has("learningActivity");
    const stages = sections.has("pathStages");
    const fees = sections.has("feeSeries") || kpis;
    const queues =
      sections.has("attentionSummary") || sections.has("priorityItems");
    const permissions = [
      ...(fees ? ["credit:read:any"] : []),
      ...(queues ? dashboardQueuePermissions : []),
    ];
    return this.snapshot.read(actor, permissions, async (tx) => {
      const userGrowth =
        sections.has("userGrowth") || kpis
          ? await readDashboardUserGrowth(tx, period)
          : [];
      const learning =
        kpis || activity || stages
          ? await readDashboardLearning(tx, period)
          : undefined;
      const fee = fees ? await readDashboardFees(tx, period) : undefined;
      const queue = queues ? await readDashboardAttention(tx) : undefined;
      return {
        period,
        ...(sections.has("userGrowth") ? { userGrowth } : {}),
        ...(kpis && learning && fee
          ? {
              kpis: {
                newUsers: userGrowth.reduce(
                  (sum, point) => sum + point.newUsers,
                  0,
                ),
                ...learning.kpis,
                netFeeCredit: fee.netFeeCredit,
              },
            }
          : {}),
        ...(activity && learning
          ? { learningActivity: learning.learningActivity }
          : {}),
        ...(stages && learning ? { pathStages: learning.pathStages } : {}),
        ...(sections.has("feeSeries") && fee
          ? { feeSeries: fee.feeSeries }
          : {}),
        ...(sections.has("attentionSummary") && queue
          ? { attentionSummary: queue.attentionSummary }
          : {}),
        ...(sections.has("priorityItems") && queue
          ? { priorityItems: queue.priorityItems }
          : {}),
      };
    });
  }

  learning(actor: Principal, query: AdminDashboardQuery) {
    const period = dashboardPeriod(query);
    const sections = selectSections(query.sections, learningSections);
    return this.snapshot.read(actor, [], async (tx) => {
      const result = await readDashboardLearning(tx, period);
      return {
        period,
        ...(sections.has("kpis") ? { kpis: result.kpis } : {}),
        ...(sections.has("learningActivity")
          ? { learningActivity: result.learningActivity }
          : {}),
        ...(sections.has("pathStages")
          ? { pathStages: result.pathStages }
          : {}),
      };
    });
  }

  finance(actor: Principal, query: AdminDashboardQuery) {
    const period = dashboardPeriod(query);
    const sections = selectSections(query.sections, [
      "kpis",
      "feeSeries",
      "paymentSeries",
      "attentionSummary",
    ] as const);
    const kpis = sections.has("kpis");
    const fees = sections.has("feeSeries");
    const payments = sections.has("paymentSeries");
    const attention = sections.has("attentionSummary");
    return this.snapshot.read(
      actor,
      [
        ...(kpis || fees ? ["credit:read:any"] : []),
        ...(kpis || payments || attention ? ["payment:read:any"] : []),
      ],
      async (tx) => {
        const result = await readDashboardFinance(tx, period, {
          fees: kpis || fees,
          payments: kpis || payments,
          attention,
        });
        return {
          period,
          ...(kpis ? { kpis: result.kpis } : {}),
          ...(fees ? { feeSeries: result.feeSeries } : {}),
          ...(payments ? { paymentSeries: result.paymentSeries } : {}),
          ...(attention ? { attentionSummary: result.attentionSummary } : {}),
        };
      },
    );
  }
}
