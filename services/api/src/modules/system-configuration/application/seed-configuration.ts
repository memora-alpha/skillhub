import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import { Prisma } from "../../../generated/prisma/client";
import {
  CONFIGURATION_DEFINITIONS,
  parseConfigurationValue,
  type ConfigurationKey,
} from "../domain/configuration.catalog";
import {
  ConfigurationRepository,
  type CurrentConfigurationRow,
} from "../infrastructure/configuration.repository";

/** Insert approved defaults only; an existing operator change is never reset. */
export async function seedApprovedConfigurations(
  tx: TransactionContext,
  repository: ConfigurationRepository,
): Promise<void> {
  const keys = Object.keys(CONFIGURATION_DEFINITIONS) as ConfigurationKey[];
  const effectiveAt = await repository.databaseNow(tx);
  const existing = new Map(
    (await repository.findCurrent(keys, tx)).map((row) => [row.key, row]),
  );

  // Both loops stay sequential: the seed runs in one transaction, which is one
  // connection, and the driver does not allow concurrent queries on it.
  for (const key of keys) {
    const definition = CONFIGURATION_DEFINITIONS[key];
    if (!existing.has(key) && "defaultValue" in definition) {
      await repository.insertMissing(
        tx,
        key,
        definition.defaultValue as Prisma.InputJsonValue,
        effectiveAt,
      );
    }
  }

  const current = new Map(
    (await repository.findCurrent(keys, tx)).map((row) => [row.key, row]),
  );
  for (const key of keys) {
    if (
      !current.has(key) &&
      !("defaultValue" in CONFIGURATION_DEFINITIONS[key])
    )
      continue;
    await ensureBaselineRevision(tx, repository, key, current.get(key));
  }
}

/** Validates the stored value and records its baseline revision once. */
async function ensureBaselineRevision(
  tx: TransactionContext,
  repository: ConfigurationRepository,
  key: ConfigurationKey,
  row: CurrentConfigurationRow | undefined,
): Promise<void> {
  if (!row || !Number.isSafeInteger(row.version) || row.version < 1) {
    throw new Error(`configuration seed could not read: ${key}`);
  }
  try {
    parseConfigurationValue(key, row.value);
  } catch {
    throw new Error(`configuration requires reconciliation: ${key}`);
  }
  if (await repository.hasRevision(tx, key, row.version)) return;
  await repository.insertRevision(tx, {
    key,
    value: row.value as Prisma.InputJsonValue,
    version: row.version,
    effectiveAt: row.effectiveAt,
    actorSnapshot: { kind: "SYSTEM", name: "SEED" },
  });
}
