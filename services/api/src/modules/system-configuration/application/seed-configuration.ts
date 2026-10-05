import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import { Prisma } from "../../../generated/prisma/client";
import {
  CONFIGURATION_DEFINITIONS,
  parseConfigurationValue,
  type ConfigurationKey,
} from "../domain/configuration.catalog";
import { ConfigurationRepository } from "../infrastructure/configuration.repository";

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

  for (const key of keys) {
    if (!existing.has(key)) {
      await repository.insertMissing(
        tx,
        key,
        CONFIGURATION_DEFINITIONS[key].defaultValue as Prisma.InputJsonValue,
        effectiveAt,
      );
    }
  }

  const current = new Map(
    (await repository.findCurrent(keys, tx)).map((row) => [row.key, row]),
  );
  for (const key of keys) {
    const row = current.get(key);
    if (!row || !Number.isSafeInteger(row.version) || row.version < 1) {
      throw new Error(`configuration seed could not read: ${key}`);
    }
    try {
      parseConfigurationValue(key, row.value);
    } catch {
      throw new Error(`configuration requires reconciliation: ${key}`);
    }
    if (!(await repository.hasRevision(tx, key, row.version))) {
      await repository.insertRevision(tx, {
        key,
        value: row.value as Prisma.InputJsonValue,
        version: row.version,
        effectiveAt: row.effectiveAt,
        actorSnapshot: { kind: "SYSTEM", name: "SEED" },
      });
    }
  }
}
