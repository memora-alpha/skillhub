// Spec 021: user subscription routes over HTTP, against an isolated PostgreSQL schema.
import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Test } from "@nestjs/testing";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { SubscriptionsController } from "../../dist/modules/subscriptions/presentation/http/subscriptions.controller.js";
import { SubscriptionPlansService } from "../../dist/modules/subscriptions/application/services/subscription-plans.service.js";
import { SubscriptionsService } from "../../dist/modules/subscriptions/application/services/subscriptions.service.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { HttpExceptionFilter } from "../../dist/shared/http/http-exception.filter.js";
import { subscriptionFixture } from "./integration-fixture.mjs";

test("subscription HTTP routes on isolated PostgreSQL", async (t) => {
  const f = await subscriptionFixture();
  let app;
  try {
    const module = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        { provide: SubscriptionPlansService, useValue: f.plans },
        { provide: SubscriptionsService, useValue: f.service },
        { provide: SessionsService, useValue: f.identity.sessions },
        {
          provide: IdentityGuard,
          useValue: new IdentityGuard(f.identity.sessions),
        },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, "127.0.0.1");
    const base = `${await app.getUrl()}/api/v1`;

    const owner = await f.account();
    await f.fund(owner, 50_000n);
    const call = async (
      method,
      path,
      { body, key, token = owner.token } = {},
    ) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body ? { "content-type": "application/json" } : {}),
          ...(key ? { "idempotency-key": key } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, body: await response.json() };
    };

    await t.test("plans list prices as Credit strings", async () => {
      const { status, body } = await call("GET", "/subscriptions/plans");
      assert.equal(status, 200);
      const creator = body.data.find((plan) => plan.planCode === "CREATOR");
      assert.equal(creator.monthPrice, "99.00");
      assert.equal(creator.yearPrice, "950.00");
    });

    await t.test("routes need a session and validate their input", async () => {
      assert.equal(
        (await call("GET", "/me/subscription", { token: null })).status,
        401,
      );
      const noKey = await call("POST", "/me/subscription", {
        body: {
          planCode: "CREATOR",
          interval: "MONTH",
          expectedPlanVersionId: f.creator.id,
        },
      });
      assert.equal(noKey.status, 400);
      assert.equal(noKey.body.message, "IDEMPOTENCY_KEY_REQUIRED");
      const badInterval = await call("POST", "/me/subscription", {
        key: "http-purchase-0",
        body: {
          planCode: "CREATOR",
          interval: "WEEK",
          expectedPlanVersionId: f.creator.id,
        },
      });
      assert.equal(badInterval.status, 400);
    });

    await t.test("purchase, read, add-on and charges round-trip", async () => {
      const bought = await call("POST", "/me/subscription", {
        key: "http-purchase-1",
        body: {
          planCode: "CREATOR",
          interval: "MONTH",
          expectedPlanVersionId: f.creator.id,
        },
      });
      assert.equal(bought.status, 201);
      assert.equal(bought.body.data.subscription.planCode, "CREATOR");

      const tooMany = await call("POST", "/me/subscription/recording-minutes", {
        key: "http-addon-0",
        body: { packs: 11, expectedPriceCredit: 30 },
      });
      assert.equal(tooMany.status, 400);
      const addon = await call("POST", "/me/subscription/recording-minutes", {
        key: "http-addon-1",
        body: { packs: 1, expectedPriceCredit: 30 },
      });
      assert.equal(addon.status, 201);
      assert.equal(addon.body.data.addonMinutesRemaining, 60);

      const me = await call("GET", "/me/subscription");
      assert.equal(me.status, 200);
      assert.equal(me.body.data.subscription.status, "ACTIVE");
      assert.equal(me.body.data.usage.recordingMinutesAllowed, 120);
      assert.deepEqual(me.body.data.materialStorage, {
        usedBytes: "0",
        allowedBytes: "3000",
        enforced: true,
      });

      const charges = await call("GET", "/me/subscription/charges");
      assert.equal(charges.status, 200);
      assert.deepEqual(
        charges.body.data.map((charge) => [charge.kind, charge.amount]),
        [
          ["RECORDING_ADDON", "30.00"],
          ["PURCHASE", "99.00"],
        ],
      );
      assert.equal(await f.wallet(owner), 50_000n - 9_900n - 3_000n);
    });
  } finally {
    await app?.close();
    await f.dispose();
  }
});
