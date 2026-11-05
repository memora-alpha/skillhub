import "reflect-metadata";
import "dotenv/config";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../dist/generated/prisma/client.js";
import { postgresConnectionString } from "../dist/infrastructure/database/postgres-connection.js";
import { TransactionRunner } from "../dist/infrastructure/database/transaction-runner.js";
import { ConfigurationRepository } from "../dist/modules/system-configuration/infrastructure/persistence/configuration.repository.js";
import { SystemConfigurationService } from "../dist/modules/system-configuration/application/services/system-configuration.service.js";
import { UpdateConfigurationUseCase } from "../dist/modules/system-configuration/application/use-cases/update-configuration.use-case.js";
import { AuditWriter } from "../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../dist/modules/audit/infrastructure/persistence/audit.repository.js";
import { withReleaseLock } from "./release.mjs";

async function main() {
  const { values } = parseArgs({
    options: {
      show: { type: "boolean", default: false },
      reference: { type: "string" },
      "expected-version": { type: "string" },
      reason: { type: "string" },
    },
  });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");
  if (
    values.show
      ? values.reference !== undefined ||
        values["expected-version"] !== undefined ||
        values.reason !== undefined
      : !values.reference?.trim() ||
        values.reference.trim().length > 200 ||
        !/^[1-9]\d*$/.test(values["expected-version"] ?? "") ||
        !Number.isSafeInteger(Number(values["expected-version"])) ||
        !values.reason?.trim()
  )
    throw new Error("INVALID_ARGUMENTS");
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: postgresConnectionString(process.env.DATABASE_URL),
      connectionTimeoutMillis: 5000,
    }),
  });
  try {
    await withReleaseLock(process.env.DATABASE_URL, async () => {
      const key = "learningPath.changeRequests";
      const repository = new ConfigurationRepository(db);
      const reader = new SystemConfigurationService(repository, {
        now: () => new Date(),
      });
      const before = await reader.getSnapshot([key]);
      let result = before;
      if (!values.show) {
        const expectedVersion = Number(values["expected-version"]);
        if (before.versions[key] !== expectedVersion)
          throw new Error("STALE_CONFIGURATION_VERSION");
        if (
          before.values[key].terminationPolicyReference !==
          values.reference.trim()
        ) {
          const update = new UpdateConfigurationUseCase(
            new TransactionRunner(db),
            repository,
            new AuditWriter(new AuditRepository()),
            reader,
          );
          result = await update.execute({
            changes: [
              {
                key,
                value: {
                  ...before.values[key],
                  terminationPolicyReference: values.reference.trim(),
                },
              },
            ],
            expectedVersions: { [key]: expectedVersion },
            actor: { kind: "SYSTEM", name: "termination-policy-cli" },
            reason: values.reason,
            context: { requestId: randomUUID(), correlationId: randomUUID() },
          });
        }
      }
      process.stdout.write(
        `${JSON.stringify({ key, value: result.values[key], version: result.versions[key] })}\n`,
      );
    });
  } finally {
    await db.$disconnect();
  }
}

try {
  await main();
} catch {
  // Database errors can contain credentials; emit only safe operator guidance.
  process.stderr.write(
    "Termination policy configuration failed. Use --show, or --reference, --expected-version and --reason; check DATABASE_URL, configuration seed and current version.\n",
  );
  process.exitCode = 1;
}
