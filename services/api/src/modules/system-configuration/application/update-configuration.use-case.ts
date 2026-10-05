import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import { TransactionRunner } from "../../../infrastructure/database/transaction-runner";
import { AuditWriter } from "../../audit/application/audit-writer";
import type { AuditInput } from "../../audit/application/audit.types";
import {
  CONFIGURATION_DEFINITIONS,
  parseConfigurationValue,
  requireMutableConfigurationKey,
  type ConfigurationKey,
} from "../domain/configuration.catalog";
import { ConfigurationRepository } from "../infrastructure/configuration.repository";
import type {
  ConfigurationSnapshot,
  UpdateConfigurationCommand,
} from "./configuration.types";
import { SystemConfigurationService } from "./system-configuration.service";

const hasOnlyKeyAndValue = (change: object): boolean =>
  Object.keys(change).length === 2 &&
  Object.hasOwn(change, "key") &&
  Object.hasOwn(change, "value");

type ValidatedChange = {
  key: ConfigurationKey;
  value: Prisma.InputJsonValue;
  expectedVersion: number;
};

@Injectable()
export class UpdateConfigurationUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly repository: ConfigurationRepository,
    private readonly audit: AuditWriter,
    private readonly reader: SystemConfigurationService,
  ) {}

  /** Internal system updates only until users/auth can recheck human permissions in-transaction. */
  async execute(
    input: UpdateConfigurationCommand,
  ): Promise<ConfigurationSnapshot<ConfigurationKey>> {
    if (input.actor?.kind !== "SYSTEM") {
      throw new ServiceUnavailableException(
        "Configuration authorization unavailable",
      );
    }
    const changes = this.validatePatch(input);
    const keys = changes.map((change) => change.key);

    return this.transactions.run(async (tx) => {
      const effectiveAt = await this.repository.databaseNow(tx);
      const rows = new Map(
        (await this.repository.findCurrent(keys, tx)).map((row) => [
          row.key,
          row,
        ]),
      );
      const audits: AuditInput[] = [];
      for (const change of changes) {
        const before = rows.get(change.key);
        if ((before?.version ?? 0) !== change.expectedVersion) {
          throw new ConflictException(
            `Configuration version conflict: ${change.key}`,
          );
        }
        audits.push(
          this.audit.validate({
            actor: input.actor,
            action: "SYSTEM_CONFIGURATION_UPDATE",
            target: { type: "SYSTEM_CONFIGURATION", id: change.key },
            before: before
              ? { value: before.value, version: before.version }
              : undefined,
            after: { value: change.value, version: change.expectedVersion + 1 },
            reason: input.reason,
            context: input.context,
          }),
        );
      }

      // Sequential on purpose: one transaction is one connection, and the
      // driver does not allow concurrent queries on it.
      for (const [index, change] of changes.entries()) {
        await this.applyChange(tx, change, audits[index], effectiveAt);
      }
      return this.reader.getSnapshot(
        Object.keys(CONFIGURATION_DEFINITIONS) as ConfigurationKey[],
        tx,
      );
    });
  }

  /** Version-checked write, then its audit row and revision, all in the caller's transaction. */
  private async applyChange(
    tx: TransactionContext,
    change: ValidatedChange,
    auditInput: AuditInput | undefined,
    effectiveAt: Date,
  ): Promise<void> {
    if (!auditInput) throw new Error("Configuration audit input unavailable");
    const written =
      change.expectedVersion === 0
        ? await this.repository.insertMissing(
            tx,
            change.key,
            change.value,
            effectiveAt,
          )
        : await this.repository.updateIfVersion(
            tx,
            change.key,
            change.expectedVersion,
            change.value,
            effectiveAt,
          );
    if (!written)
      throw new ConflictException(
        `Configuration version conflict: ${change.key}`,
      );
    const { auditId } = await this.audit.append(tx, auditInput);
    await this.repository.insertRevision(tx, {
      key: change.key,
      value: change.value,
      version: change.expectedVersion + 1,
      effectiveAt,
      actorSnapshot: auditInput.actor,
      auditId,
    });
  }

  private validatePatch(input: UpdateConfigurationCommand): ValidatedChange[] {
    if (
      !Array.isArray(input.changes) ||
      input.changes.length === 0 ||
      Object.hasOwn(input, "effectiveAt") ||
      !input.expectedVersions ||
      typeof input.expectedVersions !== "object"
    ) {
      throw new BadRequestException("Invalid configuration patch");
    }
    const seen = new Set<string>();
    const changes: ValidatedChange[] = [];
    try {
      for (const change of input.changes) {
        if (
          !change ||
          typeof change !== "object" ||
          !hasOnlyKeyAndValue(change) ||
          typeof change.key !== "string" ||
          seen.has(change.key)
        ) {
          throw new TypeError("Invalid configuration patch");
        }
        const key = requireMutableConfigurationKey(change.key);
        const expectedVersion = input.expectedVersions[key];
        if (
          typeof expectedVersion !== "number" ||
          !Number.isSafeInteger(expectedVersion) ||
          expectedVersion < 0
        ) {
          throw new TypeError("Invalid expected configuration version");
        }
        changes.push({
          key,
          value: parseConfigurationValue(
            key,
            change.value,
          ) as Prisma.InputJsonValue,
          expectedVersion,
        });
        seen.add(key);
      }
      if (Object.keys(input.expectedVersions).length !== changes.length) {
        throw new TypeError("Unexpected configuration version key");
      }
    } catch {
      throw new BadRequestException("Invalid configuration patch");
    }
    return changes;
  }
}
