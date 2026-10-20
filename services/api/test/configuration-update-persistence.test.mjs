import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { TransactionRunner } from "../dist/infrastructure/database/transaction-runner.js";
import { AuditWriter } from "../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../dist/modules/audit/infrastructure/persistence/audit.repository.js";
import { seedApprovedConfigurations } from "../dist/modules/system-configuration/application/seed-configuration.js";
import { SystemConfigurationService } from "../dist/modules/system-configuration/application/services/system-configuration.service.js";
import { UpdateConfigurationUseCase } from "../dist/modules/system-configuration/application/use-cases/update-configuration.use-case.js";
import { ConfigurationRepository } from "../dist/modules/system-configuration/infrastructure/persistence/configuration.repository.js";
import { skip, withDatabase } from "./integration-db.mjs";

// Mutates the mutable TTL policy of the isolated test database; every case starts from the current version.
const key = "storage.downloadTtlSeconds";
const newContext = () => ({
  requestId: randomUUID(),
  correlationId: randomUUID(),
});
const command = (value, version, context) => ({
  changes: [{ key, value }],
  expectedVersions: { [key]: version },
  actor: { kind: "SYSTEM", name: "foundation-test" },
  reason: "  Integration check  ",
  context,
});

async function setup(prisma) {
  const runner = new TransactionRunner(prisma);
  const repository = new ConfigurationRepository(prisma);
  const reader = new SystemConfigurationService(repository, {
    now: () => new Date(),
  });
  const audit = new AuditWriter(new AuditRepository());
  await prisma.$transaction((tx) => seedApprovedConfigurations(tx, repository));
  // Read inside a transaction so the snapshot uses database time, not this process clock.
  const current = async () => {
    const snapshot = await runner.run((tx) => reader.getSnapshot([key], tx));
    return { value: snapshot.values[key], version: snapshot.versions[key] };
  };
  const useCaseWith = (writer) =>
    new UpdateConfigurationUseCase(runner, repository, writer, reader);
  return { audit, current, useCase: useCaseWith(audit), useCaseWith };
}

test(
  "seed rerun keeps an operator value, and an update commits current, revision and audit together",
  { skip },
  () =>
    withDatabase(async (prisma) => {
      const { current, useCase } = await setup(prisma);
      const before = await current();
      const value = before.value === 60 ? 61 : 60;
      const context = newContext();

      const result = await useCase.execute(
        command(value, before.version, context),
      );
      assert.equal(result.values[key], value);
      assert.equal(result.versions[key], before.version + 1);

      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { requestId: context.requestId },
      });
      assert.equal(audit.action, "SYSTEM_CONFIGURATION_UPDATE");
      assert.equal(audit.systemActor, "foundation-test");
      assert.equal(audit.reason, "Integration check");
      assert.deepEqual(audit.before, before);
      assert.deepEqual(audit.after, { value, version: before.version + 1 });
      const revision =
        await prisma.systemConfigurationRevision.findUniqueOrThrow({
          where: { key_version: { key, version: before.version + 1 } },
        });
      assert.equal(revision.auditId, audit.id);
      assert.equal(revision.value, value);

      await setup(prisma);
      assert.deepEqual(await current(), { value, version: before.version + 1 });
    }),
);

test(
  "two updates with the same expected version: exactly one commits",
  { skip },
  () =>
    withDatabase(async (prisma) => {
      const { current, useCase } = await setup(prisma);
      const before = await current();
      const contexts = [newContext(), newContext()];

      const results = await Promise.allSettled([
        useCase.execute(command(30, before.version, contexts[0])),
        useCase.execute(command(31, before.version, contexts[1])),
      ]);
      assert.deepEqual(results.map((result) => result.status).sort(), [
        "fulfilled",
        "rejected",
      ]);
      assert.match(
        String(results.find((result) => result.status === "rejected").reason),
        /version conflict/,
      );
      assert.equal((await current()).version, before.version + 1);
      assert.equal(
        await prisma.auditLog.count({
          where: { requestId: { in: contexts.map((item) => item.requestId) } },
        }),
        1,
      );
      assert.equal(
        await prisma.systemConfigurationRevision.count({
          where: { key, version: { gt: before.version } },
        }),
        1,
      );
    }),
);

test(
  "audit failure after the mutation rolls back config, revision and audit",
  { skip },
  () =>
    withDatabase(async (prisma) => {
      const { audit, current, useCaseWith } = await setup(prisma);
      const before = await current();
      const context = newContext();
      const failingAfterInsert = {
        validate: (input) => audit.validate(input),
        append: async (tx, input) => {
          await audit.append(tx, input);
          throw new Error("audit storage failed");
        },
      };

      await assert.rejects(
        useCaseWith(failingAfterInsert).execute(
          command(before.value === 45 ? 46 : 45, before.version, context),
        ),
        /audit storage failed/,
      );
      assert.deepEqual(await current(), before);
      assert.equal(
        await prisma.auditLog.count({
          where: { requestId: context.requestId },
        }),
        0,
      );
      assert.equal(
        await prisma.systemConfigurationRevision.count({
          where: { key, version: before.version + 1 },
        }),
        0,
      );
    }),
);
