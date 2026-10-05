import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import type { ConfigurationKey } from "../domain/configuration.catalog";

export type CurrentConfigurationRow = {
  key: string;
  value: unknown;
  version: number;
  effectiveAt: Date;
};

@Injectable()
export class ConfigurationRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: Pick<PrismaService, "systemConfiguration">,
  ) {}

  async findCurrent(
    keys: readonly ConfigurationKey[],
    tx?: TransactionContext,
  ): Promise<CurrentConfigurationRow[]> {
    return (tx ?? this.prisma).systemConfiguration.findMany({
      where: { key: { in: [...keys] } },
      select: { key: true, value: true, version: true, effectiveAt: true },
    });
  }

  async databaseNow(tx: TransactionContext): Promise<Date> {
    const rows = await tx.$queryRaw<
      { now: Date }[]
    >`SELECT CURRENT_TIMESTAMP AS now`;
    const timestamp = rows[0]?.now;
    if (!(timestamp instanceof Date) || !Number.isFinite(timestamp.getTime())) {
      throw new Error("database time unavailable");
    }
    return timestamp;
  }

  async insertMissing(
    tx: TransactionContext,
    key: ConfigurationKey,
    value: Prisma.InputJsonValue,
    effectiveAt: Date,
  ): Promise<boolean> {
    const result = await tx.systemConfiguration.createMany({
      data: [{ key, value, version: 1, effectiveAt }],
      skipDuplicates: true,
    });
    return result.count === 1;
  }

  async updateIfVersion(
    tx: TransactionContext,
    key: ConfigurationKey,
    expectedVersion: number,
    value: Prisma.InputJsonValue,
    effectiveAt: Date,
  ): Promise<boolean> {
    const result = await tx.systemConfiguration.updateMany({
      where: { key, version: expectedVersion },
      data: { value, version: expectedVersion + 1, effectiveAt },
    });
    return result.count === 1;
  }

  async insertRevision(
    tx: TransactionContext,
    input: {
      key: ConfigurationKey;
      value: Prisma.InputJsonValue;
      version: number;
      effectiveAt: Date;
      actorSnapshot: Prisma.InputJsonValue;
      auditId?: string;
    },
  ): Promise<void> {
    await tx.systemConfigurationRevision.create({ data: input });
  }

  async hasRevision(
    tx: TransactionContext,
    key: ConfigurationKey,
    version: number,
  ): Promise<boolean> {
    const row = await tx.systemConfigurationRevision.findUnique({
      where: { key_version: { key, version } },
      select: { id: true },
    });
    return row !== null;
  }
}
