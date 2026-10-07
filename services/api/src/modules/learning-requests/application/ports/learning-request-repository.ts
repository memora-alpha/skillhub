import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type {
  LearningRequestRecord,
  LearningRequestTransition,
  ReplaceLearningRequestContent,
  CreateLearningRequestRecord,
} from "../contracts/learning-request.types";
import type { LearningRequestStatus } from "../../../../generated/prisma/client";

export const LEARNING_REQUEST_REPOSITORY = Symbol(
  "LEARNING_REQUEST_REPOSITORY",
);

export type LearningRequestPageFilter = {
  statuses: readonly LearningRequestStatus[];
  ownerId?: string;
  skillId?: string;
  tagIds: readonly string[];
  keyword?: string;
  now?: Date;
  expiredAtOrBefore?: Date;
  after?: { createdAt: Date; id: string } | null;
  take: number;
};

export type LearningRequestRecommendationFilter = Omit<
  LearningRequestPageFilter,
  "statuses" | "ownerId" | "now" | "after"
> & {
  candidateSkillIds: readonly string[];
  candidateTagIds: readonly string[];
  excludeOwnerId: string;
  now: Date;
  after?: { matchScore: number; createdAt: Date; id: string } | null;
};

export interface LearningRequestRepository {
  databaseNow(tx: TransactionContext): Promise<Date>;
  get(
    tx: TransactionContext,
    requestId: string,
  ): Promise<LearningRequestRecord | null>;
  lock(
    tx: TransactionContext,
    requestId: string,
  ): Promise<LearningRequestRecord | null>;
  create(
    tx: TransactionContext,
    input: CreateLearningRequestRecord,
  ): Promise<LearningRequestRecord>;
  replaceContent(
    tx: TransactionContext,
    requestId: string,
    expectedVersion: number,
    content: ReplaceLearningRequestContent,
  ): Promise<boolean>;
  transition(
    tx: TransactionContext,
    requestId: string,
    expectedVersion: number,
    from: readonly LearningRequestStatus[],
    transition: LearningRequestTransition,
  ): Promise<boolean>;
  findExpired(
    tx: TransactionContext,
    now: Date,
    batchSize: number,
  ): Promise<{ id: string; version: number }[]>;
  findPage(
    tx: TransactionContext,
    filter: LearningRequestPageFilter,
  ): Promise<LearningRequestRecord[]>;
  findRecommended(
    tx: TransactionContext,
    filter: LearningRequestRecommendationFilter,
  ): Promise<{ request: LearningRequestRecord; matchScore: number }[]>;
}
