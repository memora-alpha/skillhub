import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { configureIdentityTestEnvironment } from "./identity/test-environment.mjs";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createMaterialFixture } from "./materials/fixture.mjs";
import { AdminQaAdjustmentsController } from "../dist/modules/admin-qa-adjustments/admin-qa-adjustments.controller.js";
import { AdminQaAdjustmentsService } from "../dist/modules/admin-qa-adjustments/admin-qa-adjustments.service.js";
import { SessionsService } from "../dist/modules/auth/application/services/sessions.service.js";
import { CreditOperationsService } from "../dist/modules/credit/application/services/credit-operations.service.js";
import { CreditProvenanceService } from "../dist/modules/credit/application/services/credit-provenance.service.js";
import { ReputationService } from "../dist/modules/reputation/application/services/reputation.service.js";

configureIdentityTestEnvironment("qa-adjustment-test");

test(
  "QA adjustments are audited, replayable and scoped to test environments",
  {
    skip: !process.env.TEST_DATABASE_URL,
    timeout: 120000,
  },
  async (t) => {
    const f = await createMaterialFixture();
    t.after(() => f.dispose());
    const adminAccount = await f.account("ADMIN");
    const admin = adminAccount.principal;
    const staff = (await f.account("STAFF")).principal;
    const buyer = await f.account();
    const userId = buyer.user.id;
    const config = new ConfigService({
      APP_DEPLOYMENT_TIER: "staging",
      QA_ADMIN_ADJUSTMENTS_ENABLED: true,
    });
    let failAudit = false;
    const audit = {
      async append(tx, input) {
        if (failAudit) throw new Error("QA_TEST_AUDIT_FAILURE");
        return f.audit.append(tx, input);
      },
    };
    const reputation = new ReputationService(audit);
    const service = new AdminQaAdjustmentsService(
      config,
      f.db,
      f.commands,
      audit,
      new CreditOperationsService(new CreditProvenanceService()),
      reputation,
      f.identity.sessions,
    );
    const testingModule = await Test.createTestingModule({
      controllers: [AdminQaAdjustmentsController],
      providers: [
        { provide: AdminQaAdjustmentsService, useValue: service },
        { provide: SessionsService, useValue: f.identity.sessions },
      ],
    }).compile();
    const app = testingModule.createNestApplication({ logger: false });
    t.after(() => app.close());
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, "127.0.0.1");
    const base = `${await app.getUrl()}/api/v1/admin/users/${userId}`;
    const request = (route, body, token) =>
      fetch(`${base}/${route}-adjustments`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await request("credit", { amount: "1", reason: "QA" })).status,
      401,
    );
    assert.equal(
      (
        await request(
          "credit",
          { amount: "1.50", reason: "QA" },
          adminAccount.token,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          "reputation",
          { targetScore: "50", reason: "QA" },
          adminAccount.token,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          "reputation",
          {
            targetScore: 39,
            reason: "QA",
            releaseLowReputationRestrictions: true,
          },
          adminAccount.token,
        )
      ).status,
      400,
    );

    const credit = { amount: "100", reason: "QA purchase scenario" };
    const key = randomUUID();
    await assert.rejects(service.grantCredit(staff, userId, credit, key), {
      status: 403,
    });
    await assert.rejects(
      service.grantCredit(admin, userId, credit, undefined),
      { status: 400 },
    );
    await assert.rejects(
      service.grantCredit(admin, randomUUID(), credit, randomUUID()),
      { status: 404 },
    );
    failAudit = true;
    await assert.rejects(
      service.grantCredit(admin, userId, credit, key),
      /QA_TEST_AUDIT_FAILURE/,
    );
    assert.equal(await f.db.creditTransaction.count({ where: { userId } }), 0);
    failAudit = false;
    const [original, replay] = await Promise.all([
      service.grantCredit(admin, userId, credit, key),
      service.grantCredit(admin, userId, credit, key),
    ]);
    assert.deepEqual(replay, original);
    assert.equal(original.availableBefore, "0.00");
    assert.equal(original.availableAfter, "100.00");
    assert.equal(
      (
        await f.db.creditOperation.findUniqueOrThrow({
          where: { id: original.operationId },
        })
      ).referenceType,
      "SYSTEM",
    );
    assert.equal(
      await f.db.auditLog.count({
        where: { targetId: userId, action: "CREDIT_ADJUST" },
      }),
      1,
    );
    await assert.rejects(
      service.grantCredit(admin, userId, { ...credit, amount: "101" }, key),
      { status: 409 },
    );
    await service.grantCredit(admin, userId, credit, randomUUID());
    assert.deepEqual(
      await service.grantCredit(admin, userId, credit, key),
      original,
    );

    const score = { targetScore: 39, reason: "QA activity restriction" };
    const scoreKey = randomUUID();
    const [reduced, repeated] = await Promise.all([
      service.setReputation(admin, userId, score, scoreKey),
      service.setReputation(admin, userId, score, scoreKey),
    ]);
    assert.deepEqual(repeated, reduced);
    assert.equal(reduced.scoreBefore, 50);
    assert.equal(reduced.scoreAfter, 39);
    const assertMayCreate = () =>
      f.transactions.run((tx) =>
        reputation.assertMayCreateActivity(tx, userId, new Date()),
      );
    await assert.rejects(assertMayCreate(), /NEW_ACTIVITY_RESTRICTED/);
    await service.setReputation(
      admin,
      userId,
      { ...score, targetScore: 50 },
      randomUUID(),
    );
    await assert.rejects(assertMayCreate(), /NEW_ACTIVITY_RESTRICTED/);
    const release = {
      ...score,
      targetScore: 50,
      releaseLowReputationRestrictions: true,
    };
    const releaseKey = randomUUID();
    failAudit = true;
    await assert.rejects(
      service.setReputation(admin, userId, release, releaseKey),
      /QA_TEST_AUDIT_FAILURE/,
    );
    await assert.rejects(assertMayCreate(), /NEW_ACTIVITY_RESTRICTED/);
    failAudit = false;
    const released = await service.setReputation(
      admin,
      userId,
      release,
      releaseKey,
    );
    assert.equal(released.scoreBefore, released.scoreAfter);
    await assertMayCreate();
    assert.deepEqual(
      await service.setReputation(admin, userId, release, releaseKey),
      released,
    );
    assert.equal(
      await f.db.auditLog.count({
        where: { targetId: userId, action: "USER_RESTRICTION_REVOKE" },
      }),
      1,
    );
    assert.deepEqual(
      await service.setReputation(admin, userId, score, scoreKey),
      reduced,
    );

    const httpResult = await request(
      "credit",
      {
        amount: "1",
        reason: " QA route ",
      },
      adminAccount.token,
    );
    assert.equal(httpResult.status, 200);
    assert.equal((await httpResult.json()).data.availableAfter, "201.00");
    const material = await f.publishedMaterial(await f.account(), {
      accessType: "PAID",
      priceCredit: "10.00",
    });
    const purchase = await f.purchases.purchase(
      buyer.principal,
      material.id,
      material.listingVersion,
      randomUUID(),
    );
    assert.equal(purchase.order.status, "SUCCESS");
    assert.equal(
      (await f.db.creditWallet.findUniqueOrThrow({ where: { userId } }))
        .availableCredit,
      19100n,
    );

    await service.setReputation(
      admin,
      userId,
      { ...score, targetScore: 29 },
      randomUUID(),
    );
    await f.db.userRestriction.updateMany({
      where: { userId, revokedAt: null, reasonCode: "LOW_REPUTATION" },
      data: { endsAt: new Date(Date.now() - 1000) },
    });
    await assert.rejects(assertMayCreate(), /NEW_ACTIVITY_RESTRICTED/);
    await f.transactions.run((tx) =>
      reputation.applyAdjudicatedRestriction(tx, {
        userId,
        days: 1,
        caseId: randomUUID(),
        actor: { kind: "HUMAN", userId: admin.userId, roles: ["ADMIN"] },
        reason: "QA separate case restriction",
        now: new Date(),
      }),
    );
    const httpRelease = await request(
      "reputation",
      release,
      adminAccount.token,
    );
    assert.equal(httpRelease.status, 200);
    assert.equal((await httpRelease.json()).data.scoreAfter, 50);
    assert.equal(
      await f.db.userRestriction.count({
        where: { userId, revokedAt: null, reasonCode: "LOW_REPUTATION" },
      }),
      0,
    );
    await assert.rejects(assertMayCreate(), /NEW_ACTIVITY_RESTRICTED/);

    const reversalUserId = (await f.account()).user.id;
    await service.setReputation(
      admin,
      reversalUserId,
      { ...score, targetScore: 40 },
      randomUUID(),
    );
    await f.transactions.run((tx) =>
      reputation.assertMayCreateActivity(tx, reversalUserId, new Date()),
    );
    await service.setReputation(admin, reversalUserId, score, randomUUID());
    await service.setReputation(admin, reversalUserId, release, randomUUID());
    const violationKey = randomUUID();
    await f.transactions.run((tx) =>
      reputation.apply(tx, {
        userId: reversalUserId,
        delta: -20,
        reasonCode: "VIOLATION",
        sourceType: "ADJUDICATED_VIOLATION",
        sourceId: randomUUID(),
        eventKey: violationKey,
        now: new Date(),
        evaluateRestriction: true,
      }),
    );
    const violation = await f.db.reputationHistory.findUniqueOrThrow({
      where: { eventKey: violationKey },
    });
    await f.transactions.run((tx) =>
      reputation.reverseEvent(
        tx,
        admin,
        violation.id,
        "QA reverse second violation",
      ),
    );
    await f.transactions.run((tx) =>
      reputation.assertMayCreateActivity(tx, reversalUserId, new Date()),
    );

    await f.db.rolePermission.deleteMany({
      where: {
        roleIdRecord: { code: "ADMIN" },
        permissionIdRecord: { code: "credit:adjust:qa" },
      },
    });
    await assert.rejects(service.grantCredit(admin, userId, credit, key), {
      status: 403,
    });
    config.set("QA_ADMIN_ADJUSTMENTS_ENABLED", false);
    assert.equal(
      (await request("credit", { amount: "1", reason: "QA" })).status,
      404,
    );
    await assert.rejects(service.grantCredit(admin, userId, credit, key), {
      status: 404,
    });
    await assert.rejects(
      service.setReputation(admin, userId, score, scoreKey),
      { status: 404 },
    );
  },
);
