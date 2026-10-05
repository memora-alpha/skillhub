import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "./prisma.service";
import { isRetryableDatabaseConflict } from "./transaction-errors";
import type { TransactionContext } from "./transaction-context";

export type TransactionOptions = {
  isolationLevel?: "Serializable" | "ReadCommitted";
};

const sleepFor = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

@Injectable()
export class TransactionRunner {
  constructor(
    private readonly prisma: Pick<PrismaService, "$transaction">,
    private readonly sleep: (milliseconds: number) => Promise<void> = sleepFor,
  ) {}

  async run<T>(
    work: (tx: TransactionContext) => Promise<T>,
    options: TransactionOptions = {},
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt++) {
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
        if (attempt === 3 || !isRetryableDatabaseConflict(error)) throw error;
        await this.sleep(
          50 * 2 ** (attempt - 1) + Math.floor(Math.random() * 50),
        );
      }
    }
    throw new Error("Transaction retry exhausted");
  }
}
