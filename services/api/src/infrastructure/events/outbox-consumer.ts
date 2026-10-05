import { BadRequestException, Injectable } from "@nestjs/common";
import { TransactionRunner } from "../database/transaction-runner";
import type { TransactionContext } from "../database/transaction-context";

@Injectable()
export class OutboxConsumer {
  constructor(private readonly transactions: TransactionRunner) {}

  async processOnce<T>(
    consumer: string,
    eventId: string,
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<{ processed: boolean; value?: T }> {
    if (
      !/^[a-z][a-z0-9.:-]{0,127}$/.test(consumer) ||
      !/^[0-9a-f-]{36}$/i.test(eventId)
    ) {
      throw new BadRequestException("Invalid outbox delivery identity");
    }
    return this.transactions.run(async (tx) => {
      const inserted = await tx.$executeRaw`
        INSERT INTO "outbox_consumer_receipts" ("consumer", "event_id")
        VALUES (${consumer}, ${eventId}::uuid)
        ON CONFLICT ("consumer", "event_id") DO NOTHING
      `;
      if (inserted === 0) return { processed: false };
      const value = await work(tx);
      return { processed: true, value };
    });
  }
}
