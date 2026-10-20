import "dotenv/config";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../dist/generated/prisma/client.js";
import { postgresConnectionString } from "../dist/infrastructure/database/postgres-connection.js";
import { TransactionRunner } from "../dist/infrastructure/database/transaction-runner.js";
import { ConfigurationRepository } from "../dist/modules/system-configuration/infrastructure/configuration.repository.js";
import { SystemConfigurationService } from "../dist/modules/system-configuration/application/system-configuration.service.js";
import { UpdateConfigurationUseCase } from "../dist/modules/system-configuration/application/update-configuration.use-case.js";
import { parseConfigurationValue } from "../dist/modules/system-configuration/domain/configuration.catalog.js";
import { AuditWriter } from "../dist/modules/audit/application/audit-writer.js";
import { AuditRepository } from "../dist/modules/audit/infrastructure/audit.repository.js";

async function main() {
  const { values } = parseArgs({
    options: {
      "early-minutes": { type: "string" },
      "late-minutes": { type: "string" },
      "expected-version": { type: "string" },
      reason: { type: "string" },
    },
  });
  for (const key of ["early-minutes", "late-minutes", "expected-version"])
    if (!/^\d+$/.test(values[key] ?? "")) throw new Error("INVALID_ARGUMENTS");
  if (!values.reason?.trim() || !process.env.DATABASE_URL)
    throw new Error("INVALID_ARGUMENTS");
  const policy = parseConfigurationValue("livekit.joinWindow", {
    earlyMinutes: Number(values["early-minutes"]),
    lateMinutes: Number(values["late-minutes"]),
  });
  const expectedVersion = Number(values["expected-version"]);
  if (!Number.isSafeInteger(expectedVersion))
    throw new Error("INVALID_ARGUMENTS");
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: postgresConnectionString(process.env.DATABASE_URL),
    }),
  });
  try {
    const repository = new ConfigurationRepository(db);
    const reader = new SystemConfigurationService(repository, {
      now: () => new Date(),
    });
    const update = new UpdateConfigurationUseCase(
      new TransactionRunner(db),
      repository,
      new AuditWriter(new AuditRepository()),
      reader,
    );
    const result = await update.execute({
      changes: [{ key: "livekit.joinWindow", value: policy }],
      expectedVersions: { "livekit.joinWindow": expectedVersion },
      actor: { kind: "SYSTEM", name: "livekit-configuration-cli" },
      reason: values.reason,
      context: { requestId: randomUUID(), correlationId: randomUUID() },
    });
    process.stdout.write(
      `livekit.joinWindow updated to version ${result.versions["livekit.joinWindow"]}\n`,
    );
  } finally {
    await db.$disconnect();
  }
}

try {
  await main();
} catch {
  // Provider/DB exceptions can include credentials; print only safe operator guidance.
  process.stderr.write(
    "LiveKit configuration failed. Supply --early-minutes, --late-minutes, --expected-version and --reason; check DATABASE_URL, approved config seed and current version.\n",
  );
  process.exitCode = 1;
}
