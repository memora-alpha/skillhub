import assert from "node:assert/strict";
import "reflect-metadata";
import { test } from "node:test";
import { validateSync } from "class-validator";
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  VERSION_METADATA,
} from "@nestjs/common/constants.js";
import { validateAuditInput } from "../../dist/modules/audit/domain/audit-action.catalog.js";
import { LearningRequestModerationRulesUseCase } from "../../dist/modules/system-configuration/application/use-cases/learning-request-moderation-rules.use-case.js";
import { LearningRequestModerationRulesController } from "../../dist/modules/system-configuration/presentation/http/learning-request-moderation-rules.controller.js";
import { UpdateLearningRequestModerationRulesDto } from "../../dist/modules/system-configuration/presentation/http/learning-request-moderation-rules.dto.js";
import { IdentityGuard } from "../../dist/shared/auth/identity.guard.js";

const key = "learningRequest.moderationRuleSet";
const now = new Date("2026-10-06T00:00:00.000Z");
const context = {
  requestId: "c3834caf-1193-4de1-a747-d06ca611502e",
  correlationId: "10aa9290-51c4-4169-b6e7-f0d2b5b6c629",
};
const principal = {
  userId: "11111111-1111-4111-8111-111111111111",
  sessionId: "22222222-2222-4222-8222-222222222222",
  securityVersion: 1,
  roles: ["ADMIN"],
  permissions: ["learning-request:moderation:configure"],
};

function fixture() {
  let state = {
    row: { key, value: { rules: [] }, version: 1, effectiveAt: now },
    revisions: [],
    audits: [],
  };
  const repository = {
    async findCurrent(keys, tx) {
      const current = tx?.data ?? state;
      return keys.includes(key) ? [current.row] : [];
    },
    async databaseNow() {
      return now;
    },
    async updateIfVersion(
      tx,
      candidateKey,
      expectedVersion,
      value,
      effectiveAt,
    ) {
      const current = tx.data.row;
      if (candidateKey !== key || current.version !== expectedVersion)
        return false;
      tx.data.row = {
        key,
        value: structuredClone(value),
        version: expectedVersion + 1,
        effectiveAt,
      };
      return true;
    },
    async insertRevision(tx, revision) {
      tx.data.revisions.push(revision);
    },
  };
  const transactions = {
    async run(work) {
      const staged = structuredClone(state);
      const result = await work({ data: staged, $queryRaw: async () => [] });
      state = staged;
      return result;
    },
  };
  let live = principal;
  const sessions = {
    async assertLive(_tx, actor) {
      assert.equal(actor, principal);
      return live;
    },
  };
  const audit = {
    validate: validateAuditInput,
    async append(tx, input) {
      tx.data.audits.push(input);
      return { auditId: "b8f10566-2df5-4f5c-9742-5df2e012d2e9" };
    },
  };
  const reader = {
    async getSnapshot(keys, tx) {
      assert.deepEqual(keys, [key]);
      const row = (tx?.data ?? state).row;
      return {
        values: { [key]: structuredClone(row.value) },
        versions: { [key]: row.version },
        readAt: now,
      };
    },
  };
  return {
    state: () => state,
    setLive: (value) => {
      live = value;
    },
    useCase: new LearningRequestModerationRulesUseCase(
      transactions,
      sessions,
      repository,
      audit,
      reader,
    ),
  };
}

test("admin routes expose only the versioned rule resource and require IdentityGuard", () => {
  assert.equal(
    Reflect.getMetadata(
      PATH_METADATA,
      LearningRequestModerationRulesController,
    ),
    "admin/learning-requests/moderation-rules",
  );
  assert.equal(
    Reflect.getMetadata(
      VERSION_METADATA,
      LearningRequestModerationRulesController,
    ),
    "1",
  );
  assert.ok(
    Reflect.getMetadata(
      GUARDS_METADATA,
      LearningRequestModerationRulesController,
    ).includes(IdentityGuard),
  );
  assert.equal(
    Reflect.getMetadata(
      METHOD_METADATA,
      LearningRequestModerationRulesController.prototype.get,
    ),
    0,
  );
  assert.equal(
    Reflect.getMetadata(
      METHOD_METADATA,
      LearningRequestModerationRulesController.prototype.update,
    ),
    2,
  );
});

test("admin reads and updates one configuration key with live grant and audit", async () => {
  const fx = fixture();
  assert.deepEqual(await fx.useCase.get(principal), {
    rules: [],
    version: 1,
    readAt: now,
  });
  const result = await fx.useCase.update(principal, {
    expectedVersion: 1,
    rules: [{ category: "safety", pattern: "  Ｕnsafe   phrase " }],
    reason: "Update reviewed moderation terms",
    context,
  });
  assert.deepEqual(result.rules, [
    { category: "SAFETY", pattern: "unsafe phrase" },
  ]);
  assert.equal(result.version, 2);
  assert.equal(fx.state().audits[0].target.id, key);
  assert.equal(fx.state().audits[0].actor.userId, principal.userId);
  assert.equal(
    fx.state().revisions[0].auditId,
    "b8f10566-2df5-4f5c-9742-5df2e012d2e9",
  );
});

test("empty rules, stale versions and revoked grants cannot update configuration", async () => {
  const fx = fixture();
  const update = (expectedVersion, rules) =>
    fx.useCase.update(principal, {
      expectedVersion,
      rules,
      reason: "Update reviewed moderation terms",
      context,
    });
  await assert.rejects(
    () => update(1, []),
    (error) => error?.getStatus?.() === 400,
  );
  await assert.rejects(
    () => update(2, [{ category: "SAFETY", pattern: "unsafe phrase" }]),
    (error) => error?.getStatus?.() === 409,
  );
  fx.setLive({ ...principal, permissions: [] });
  await assert.rejects(
    () => update(1, [{ category: "SAFETY", pattern: "unsafe phrase" }]),
    (error) => error?.getStatus?.() === 403,
  );
  assert.equal(fx.state().row.version, 1);
  assert.equal(fx.state().revisions.length, 0);
});

test("HTTP DTO requires an expected version, nonempty bounded rules and an audit reason", () => {
  const dto = Object.assign(new UpdateLearningRequestModerationRulesDto(), {
    expectedVersion: 1,
    rules: [],
    reason: "short",
  });
  const properties = validateSync(dto).flatMap((error) =>
    Object.keys(error.constraints ?? {}),
  );
  assert.ok(properties.includes("arrayMinSize"));
  assert.ok(properties.includes("minLength"));
});
