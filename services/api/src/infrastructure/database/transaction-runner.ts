import { randomInt } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "./prisma.service";
import { isRetryableDatabaseConflict } from "./transaction-errors";
import type { TransactionContext } from "./transaction-context";

export type TransactionOptions = {
  isolationLevel?: "Serializable" | "ReadCommitted";
};

const maxAttempts = 3;

const sleepFor = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

@Injectable()
export class TransactionRunner {
  constructor(
    private readonly prisma: Pick<PrismaService, "$transaction">,
    private readonly sleep: (milliseconds: number) => Promise<void> = sleepFor,
  ) {}

  run<T>(
    work: (tx: TransactionContext) => Promise<T>,
    options: TransactionOptions = {},
  ): Promise<T> {
    return this.attempt(work, options, 1);
  }

  /** Every attempt is a new transaction; only database conflicts are retried. */
  private async attempt<T>(
    work: (tx: TransactionContext) => Promise<T>,
    options: TransactionOptions,
    attempt: number,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(work, {
        isolationLevel:
          options.isolationLevel === "ReadCommitted"
            ? Prisma.TransactionIsolationLevel.ReadCommitted
            : Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 2000,
        timeout: 5000,
      });
    } catch (error) {
      if (attempt === maxAttempts || !isRetryableDatabaseConflict(error))
        throw error;
      await this.sleep(50 * 2 ** (attempt - 1) + randomInt(50));
      return this.attempt(work, options, attempt + 1);
    }
  }
}
