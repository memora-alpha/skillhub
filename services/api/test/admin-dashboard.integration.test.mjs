import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createMaterialFixture } from "./materials/fixture.mjs";
import { configureIdentityTestEnvironment } from "./identity/test-environment.mjs";
import { AdminDashboardService } from "../dist/modules/admin-dashboard/admin-dashboard.service.js";
import { DashboardSnapshot } from "../dist/modules/admin-dashboard/dashboard-snapshot.js";
import { AdminPaymentsReader } from "../dist/modules/payments/application/services/admin-payments.reader.js";

configureIdentityTestEnvironment("dashboard-test");

test(
  "dashboard reads the migrated schema and grants, local buckets and paid-at boundaries",
  {
    skip: !process.env.TEST_DATABASE_URL,
    timeout: 120_000,
  },
  async () => {
    const f = await createMaterialFixture();
    try {
      const admin = await f.account("ADMIN");
      const user = await f.account();
      const service = new AdminDashboardService(
        new DashboardSnapshot(f.transactions, f.identity.sessions),
      );
      const query = {
        from: "2026-11-30T00:00:00+07:00",
        to: "2026-12-02T00:00:00+07:00",
      };
      await f.db.user.update({
        where: { id: user.user.id },
        data: { createdAt: new Date(query.from) },
      });
      await f.db.tagCreationRequest.createMany({
        data: Array.from({ length: 12 }, (_, index) => ({
          label: `Tag ${index}`,
          labelKey: `tag-${index}`,
          requestedByUserId: user.user.id,
          createdAt: new Date(Date.parse(query.from) + index),
        })),
      });
      for (const [status, paidAt] of [
        ["PAID", new Date("2026-12-01T00:00:00+07:00")],
        ["PAID", new Date(query.to)],
        ["REVIEW", null],
      ]) {
        await f.db.payment.create({
          data: {
            userId: user.user.id,
            paymentAmountVnd: 1000n,
            creditAmount: 100n,
            currency: "VND",
            gateway: "PAYOS",
            status,
            createdAt: new Date("2026-11-29T00:00:00Z"),
            payosCheckout: {
              create: {
                channel: "dashboard-test",
                quoteDigest: "test",
                policyVersion: "test",
                expiresAt: new Date(query.to),
                returnUrl: "https://example.com/return",
                cancelUrl: "https://example.com/cancel",
                paidAt,
              },
            },
          },
        });
      }
      const overview = await service.overview(admin.principal, query);
      assert.equal(overview.kpis.newUsers, 1);
      assert.equal(overview.attentionSummary.TAG_REQUEST, 12);
      assert.equal(overview.priorityItems.length, 10);
      assert.equal(overview.priorityItems[0].label, "Tag 11");
      const learning = await service.learning(admin.principal, {
        ...query,
        granularity: "month",
      });
      assert.deepEqual(
        learning.learningActivity.map((row) => row.key),
        ["2026-11", "2026-12"],
      );
      const finance = await service.finance(admin.principal, query);
      assert.deepEqual(
        finance.paymentSeries.map((row) => row.paidAmountVnd),
        ["0", "1000"],
      );
      assert.equal(finance.kpis.paidCreditAmount, "1.00");
      assert.equal(finance.attentionSummary.paymentsInReview, 1);
      const payments = new AdminPaymentsReader(
        f.transactions,
        f.identity.sessions,
        { jwtKey: "dashboard-test" },
      );
      const paid = await payments.list(admin.principal, {
        limit: 1,
        status: "PAID",
        paidFrom: query.from,
        paidBefore: query.to,
        includeTotal: "true",
      });
      assert.equal(paid.pagination.total, finance.kpis.paidOrders);
      assert.equal(paid.data[0].paymentAmountVnd, finance.kpis.paidAmountVnd);
      await assert.rejects(
        service.learning(user.principal, query),
        /DASHBOARD_PERMISSION_REQUIRED/,
      );
    } finally {
      await f.dispose();
    }
  },
);
