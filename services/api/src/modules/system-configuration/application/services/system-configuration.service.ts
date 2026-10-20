import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { CLOCK, type Clock } from "../../../../shared/time/clock";
import {
  isConfigurationKey,
  parseConfigurationValue,
  type ConfigurationKey,
  type ConfigurationValues,
} from "../../domain/configuration.catalog";
import { ConfigurationRepository } from "../../infrastructure/persistence/configuration.repository";
import type { ConfigurationSnapshot } from "../contracts/configuration.types";

@Injectable()
export class SystemConfigurationService {
  constructor(
    private readonly repository: ConfigurationRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async getSnapshot<K extends ConfigurationKey>(
    keys: readonly K[],
    tx?: TransactionContext,
  ): Promise<ConfigurationSnapshot<K>> {
    const readAt = tx
      ? await this.repository.databaseNow(tx)
      : this.clock.now();
    if (
      new Set(keys).size !== keys.length ||
      keys.some((key) => !isConfigurationKey(key))
    ) {
      throw new TypeError("invalid configuration key list");
    }
    const rows = await this.repository.findCurrent(keys, tx);
    const byKey = new Map(rows.map((row) => [row.key, row]));
    const values = {} as ConfigurationValues<K>;
    const versions = {} as Record<K, number>;
    for (const key of keys) {
      const row = byKey.get(key);
      if (
        !row ||
        !Number.isSafeInteger(row.version) ||
        row.version < 1 ||
        !Number.isFinite(row.effectiveAt.getTime()) ||
        row.effectiveAt > readAt
      ) {
        throw new ServiceUnavailableException(
          `Configuration not ready: ${key}`,
        );
      }
      try {
        values[key] = parseConfigurationValue(key, row.value);
      } catch {
        throw new ServiceUnavailableException(
          `Configuration not ready: ${key}`,
        );
      }
      versions[key] = row.version;
    }
    return { values, versions, readAt };
  }
}
