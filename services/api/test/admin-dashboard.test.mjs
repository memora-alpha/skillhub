import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Module,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AdminDashboardController } from "../dist/modules/admin-dashboard/admin-dashboard.controller.js";
import { AdminDashboardService } from "../dist/modules/admin-dashboard/admin-dashboard.service.js";
import { SessionsService } from "../dist/modules/auth/application/services/sessions.service.js";
import { TransactionRunner } from "../dist/infrastructure/database/transaction-runner.js";
import {
  dashboardPeriod,
  dashboardBuckets,
} from "../dist/modules/admin-dashboard/dashboard-period.js";
import { DashboardSnapshot } from "../dist/modules/admin-dashboard/dashboard-snapshot.js";
import { readDashboardLearning } from "../dist/modules/learning-paths/application/services/dashboard-learning.reader.js";
import { readDashboardFinance } from "../dist/modules/admin-dashboard/dashboard-finance.js";
import { readDashboardAttention } from "../dist/modules/admin-dashboard/dashboard-attention.js";

const range = {
  from: "2026-11-30T12:00:00+07:00",
  to: "2026-12-01T12:00:00+07:00",
  timezone: "Asia/Ho_Chi_Minh",
};

test("dashboard range normalizes offsets and rejects invalid or unbounded queries", () => {
  const period = dashboardPeriod(range);
  assert.equal(period.from.toISOString(), "2026-11-30T05:00:00.000Z");
  assert.equal(period.to.toISOString(), "2026-12-01T05:00:00.000Z");
  assert.equal(period.granularity, "day");
  for (const change of [
    { from: "2026-11-30T12:00:00" },
    { from: "2026-11-31T12:00:00+07:00" },
    { to: range.from },
    { to: "2028-01-01T00:00:00Z" },
    { timezone: "NOT_A_ZONE" },
    { granularity: "week" },
  ])
    assert.throws(
      () => dashboardPeriod({ ...range, ...change }),
      /INVALID_DASHBOARD/,
    );
});

test("calendar buckets use local boundaries while clipping to the requested interval", () => {
  const expected = [
    ["2026-11-30T05:00:00.000Z", "2026-11-30T17:00:00.000Z"],
    ["2026-11-30T17:00:00.000Z", "2026-12-01T05:00:00.000Z"],
  ];
  for (const granularity of ["day", "month"]) {
    const buckets = dashboardBuckets(
      dashboardPeriod({ ...range, granularity }),
    );
    assert.deepEqual(
      buckets.map(({ bucketStart, bucketEnd }) => [bucketStart, bucketEnd]),
      expected,
    );
    assert.deepEqual(
      buckets.map(({ key }) => key),
      granularity === "month"
        ? ["2026-11", "2026-12"]
        : ["2026-11-30", "2026-12-01"],
    );
  }
});

test("snapshot revalidates ADMIN and section permissions before data access", async () => {
  const now = new Date("2026-12-01T00:00:00Z");
  const calls = [];
  const tx = {
    $executeRaw: async () => calls.push("read-only"),
    $queryRaw: async () => {
      calls.push("clock");
      return [{ now }];
    },
  };
  const snapshot = new DashboardSnapshot(
    { run: (read) => read(tx) },
    {
      assertLive: async (seen, actor) => {
        assert.equal(seen, tx);
        calls.push("live");
        return actor;
      },
    },
  );
  const section = (seen, asOf) => {
    assert.equal(seen, tx);
    assert.equal(asOf, now);
    calls.push("read");
    return { total: 5 };
  };
  for (const actor of [
    { roles: ["USER"], permissions: ["dashboard:read", "credit:read:any"] },
    { roles: ["STAFF"], permissions: ["dashboard:read", "credit:read:any"] },
    { roles: ["ADMIN"], permissions: [] },
    { roles: ["ADMIN"], permissions: ["dashboard:read"] },
  ]) {
    await assert.rejects(
      snapshot.read(actor, ["credit:read:any"], section),
      /DASHBOARD_PERMISSION_REQUIRED/,
    );
    assert.deepEqual(calls.splice(0), ["read-only", "live"]);
  }
  assert.deepEqual(
    await snapshot.read(
      { roles: ["ADMIN"], permissions: ["dashboard:read", "credit:read:any"] },
      ["credit:read:any"],
      section,
    ),
    { asOf: now, total: 5 },
  );
  assert.deepEqual(calls, ["read-only", "live", "clock", "read"]);
});

test("learning counts and time series retain their explicit creation and schedule bases", async () => {
  const period = dashboardPeriod(range);
  const statements = [];
  const tx = {
    $queryRaw: async (parts, ...args) => {
      statements.push({ sql: parts.join("?"), args });
      return [
        { kind: "path", key: "2026-11-30", status: "ACTIVE", count: 3n },
        { kind: "session", key: "2026-11-30", status: "COMPLETED", count: 2n },
        { kind: "settled", key: "2026-12-01", status: "", count: 1n },
      ];
    },
  };
  const result = await readDashboardLearning(tx, period);
  assert.deepEqual(result.kpis, {
    pathsCreated: 3,
    pathsSettled: 1,
    sessionsScheduled: 2,
    completedScheduledSessions: 2,
  });
  assert.deepEqual(result.pathStages, [{ status: "ACTIVE", count: 3 }]);
  assert.deepEqual(
    result.learningActivity.map(
      ({ key, pathsCreated, pathsSettled, sessionsScheduled }) => [
        key,
        pathsCreated,
        pathsSettled,
        sessionsScheduled,
      ],
    ),
    [
      ["2026-11-30", 3, 0, 2],
      ["2026-12-01", 0, 1, 0],
    ],
  );
  assert.match(statements[0].sql, /created_at/);
  assert.match(statements[0].sql, /start_at/);
  assert.match(statements[0].sql, /settled_at/);
  assert.ok(statements[0].args.includes(period.from));
});

test("finance separates recorded fees from paid VND and fills empty buckets exactly", async () => {
  const tx = {
    $queryRaw: async (parts) => {
      const sql = parts.join("?");
      if (sql.includes("PLATFORM_FEE"))
        return [
          {
            period: "2026-11-30",
            business: "MATERIAL_PURCHASE",
            collected: 100n,
            refunded: 125n,
          },
        ];
      assert.match(sql, /paid_at/);
      return [
        {
          period: "2026-11-30",
          orders: 1n,
          vnd: 900719925474099301n,
          credit: 101n,
        },
      ];
    },
    payment: {
      count: async ({ where }) => {
        assert.deepEqual(where, { status: "REVIEW" });
        return 4;
      },
    },
  };
  const result = await readDashboardFinance(tx, dashboardPeriod(range));
  assert.equal(result.kpis.paidAmountVnd, "900719925474099301");
  assert.equal(result.kpis.netFeeCredit, "-0.25");
  assert.equal(result.kpis.paidCreditAmount, "1.01");
  assert.equal(result.paymentSeries[1].paidAmountVnd, "0");
  assert.equal(result.feeSeries[1].netCredit, "0.00");
  assert.equal(result.attentionSummary.paymentsInReview, 4);
});

test("attention counts all eligible rows and selects the newest across queues", async () => {
  const tx = {
    $queryRaw: async (parts) => {
      const sql = parts.join("?");
      assert.match(sql, /COUNT\(\*\) OVER/);
      assert.match(sql, /ORDER BY created_at DESC/);
      assert.match(sql, /report_cases/);
      assert.match(sql, /expires_at > CURRENT_TIMESTAMP/);
      return [
        {
          type: "REPORT_CASE",
          id: "case-1",
          status: "NEED_MORE_INFO",
          label: "NO_SHOW",
          createdAt: new Date(range.from),
          total: 24n,
        },
        {
          type: "TAG_REQUEST",
          id: "tag-1",
          status: "PENDING",
          label: "tag",
          createdAt: new Date(range.from),
          total: 2n,
        },
      ];
    },
  };
  const result = await readDashboardAttention(tx);
  assert.equal(result.attentionSummary.REPORT_CASE, 24);
  assert.equal(result.attentionSummary.MATERIAL, 0);
  assert.equal(result.priorityItems[0].id, "case-1");
  assert.ok(!("total" in result.priorityItems[0]));
});

test("dashboard HTTP routes enforce authentication and section validation", async () => {
  const reads = [];
  const tx = {
    $executeRaw: async () => undefined,
    $queryRaw: async (parts) => {
      const sql = parts.join("?");
      if (sql.includes("CURRENT_TIMESTAMP"))
        return [{ now: new Date(range.to) }];
      reads.push(sql);
      return [];
    },
    payment: { count: async () => 0 },
  };
  const sessions = {
    principal: async (token) => {
      if (token === "expired") throw new UnauthorizedException();
      return {
        roles: [token === "staff" ? "STAFF" : "ADMIN"],
        permissions: [
          "dashboard:read",
          ...(token === "finance"
            ? ["credit:read:any", "payment:read:any"]
            : []),
        ],
      };
    },
    assertLive: async (_tx, actor) => actor,
  };
  class FixtureModule {}
  Module({
    controllers: [AdminDashboardController],
    providers: [
      DashboardSnapshot,
      AdminDashboardService,
      { provide: SessionsService, useValue: sessions },
      { provide: TransactionRunner, useValue: { run: (read) => read(tx) } },
    ],
  })(FixtureModule);
  const app = await NestFactory.create(FixtureModule, { logger: false });
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(0, "127.0.0.1");
  try {
    const base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1/admin/dashboard`;
    const request = (path, token, filters = {}) =>
      fetch(
        `${base}/${path}?${new URLSearchParams({ ...range, ...filters })}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
    for (const [path, token, filters, status] of [
      ["learning", null, {}, 401],
      ["learning", "expired", {}, 401],
      ["learning", "staff", {}, 403],
      ["finance", "admin", {}, 403],
      ["learning", "admin", { sections: "payments" }, 400],
      ["learning", "admin", { timezone: "bad" }, 400],
      ["learning", "admin", { from: "2026-11-30T12:00:00" }, 400],
      ["learning", "admin", { unknown: "yes" }, 400],
    ])
      assert.equal((await request(path, token, filters)).status, status);
    assert.equal(reads.length, 0);
    const overview = await request("overview", "admin", {
      sections: "userGrowth",
    });
    assert.equal(overview.status, 200);
    assert.equal(overview.headers.get("cache-control"), "no-store");
    const { data } = await overview.json();
    assert.deepEqual(
      Object.keys(data).sort(),
      ["asOf", "period", "userGrowth"].sort(),
    );
    assert.deepEqual(
      data.userGrowth.map(({ newUsers }) => newUsers),
      [0, 0],
    );
    assert.equal(reads.length, 1);
    assert.match(reads[0], /FROM users/);
    assert.equal((await request("learning", "admin")).status, 200);
    assert.equal((await request("finance", "finance")).status, 200);
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    for (const path of ["overview", "learning", "finance"]) {
      const endpoint = doc.paths[`/api/v1/admin/dashboard/${path}`].get;
      assert.ok(endpoint.parameters.some(({ name }) => name === "from"));
      assert.ok(
        endpoint.responses[200].content["application/json"].schema.properties
          .data,
      );
    }
  } finally {
    await app.close();
  }
});
