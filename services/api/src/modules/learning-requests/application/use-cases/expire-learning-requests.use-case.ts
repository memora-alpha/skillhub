import { Injectable, Inject } from "@nestjs/common";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import {
  LEARNING_REQUEST_REPOSITORY,
  type LearningRequestRepository,
} from "../ports/learning-request-repository";

const expiryStatuses = ["OPEN", "PENDING_MODERATION"] as const;
const maxBatchSize = 500;

@Injectable()
export class ExpireLearningRequestsUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    @Inject(LEARNING_REQUEST_REPOSITORY)
    private readonly repository: LearningRequestRepository,
  ) {}

  async execute(batchSize = 100): Promise<{ processed: number }> {
    if (
      !Number.isSafeInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > maxBatchSize
    ) {
      throw new RangeError(`batchSize must be between 1 and ${maxBatchSize}`);
    }
    const candidates = await this.transactions.run(async (tx) => {
      const now = await this.repository.databaseNow(tx);
      return this.repository.findExpired(tx, now, batchSize);
    });
    let processed = 0;
    for (const candidate of candidates) {
      const expired = await this.transactions.run(async (tx) => {
        const request = await this.repository.lock(tx, candidate.id);
        if (
          request?.version !== candidate.version ||
          !expiryStatuses.includes(
            request.status as (typeof expiryStatuses)[number],
          )
        ) {
          return false;
        }
        const now = await this.repository.databaseNow(tx);
        if (request.expiresAt === null || request.expiresAt > now) return false;
        return this.repository.transition(
          tx,
          request.id,
          candidate.version,
          expiryStatuses,
          { status: "EXPIRED" },
        );
      });
      if (expired) processed += 1;
    }
    return { processed };
  }
}
