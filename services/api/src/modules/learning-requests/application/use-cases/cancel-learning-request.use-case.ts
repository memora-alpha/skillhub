import {
  BadRequestException,
  ConflictException,
  Injectable,
  Inject,
  NotFoundException,
} from "@nestjs/common";
import { lockUsers } from "../../../../shared/database/identity-transactions";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { Principal } from "../../../auth/application/services/sessions.service";
import {
  REQUEST_LOCK_READER,
  type RequestLockReader,
} from "../ports/learning-request-dependencies";
import {
  LEARNING_REQUEST_REPOSITORY,
  type LearningRequestRepository,
} from "../ports/learning-request-repository";
import {
  toLearningRequestOwnerDetail,
  type LearningRequestOwnerDetail,
} from "../contracts/learning-request.types";
import { LearningRequestAccessService } from "../services/learning-request-access.service";

const cancelableStatuses = [
  "DRAFT",
  "OPEN",
  "PENDING_MODERATION",
  "REJECTED",
  "NEGOTIATING",
] as const;

@Injectable()
export class CancelLearningRequestUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly access: LearningRequestAccessService,
    @Inject(LEARNING_REQUEST_REPOSITORY)
    private readonly repository: LearningRequestRepository,
    @Inject(REQUEST_LOCK_READER)
    private readonly requestLock: RequestLockReader,
  ) {}

  async execute(
    actor: Principal,
    requestId: string,
    input: { expectedVersion: number },
  ): Promise<LearningRequestOwnerDetail> {
    if (
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 1
    ) {
      throw new BadRequestException("INVALID_REQUEST_INPUT");
    }
    return this.transactions.run(async (tx) => {
      await lockUsers(tx, [actor.userId]);
      const live = await this.access.assertUserAction(
        tx,
        actor,
        "learning-request:cancel:self",
      );
      const request = await this.repository.lock(tx, requestId);
      if (!request || request.ownerId !== live.userId)
        throw new NotFoundException();
      const snapshot = { ...request };
      const now = await this.repository.databaseNow(tx);
      if (
        request.version !== input.expectedVersion ||
        !cancelableStatuses.includes(
          request.status as (typeof cancelableStatuses)[number],
        )
      ) {
        throw new ConflictException("REQUEST_VERSION_CONFLICT");
      }
      if (
        ["OPEN", "PENDING_MODERATION"].includes(request.status) &&
        request.expiresAt !== null &&
        request.expiresAt <= now
      ) {
        throw new ConflictException("REQUEST_EXPIRED");
      }
      if (request.status === "NEGOTIATING") {
        await this.requestLock.assertNotLocked(tx, request.id);
      }
      const written = await this.repository.transition(
        tx,
        request.id,
        input.expectedVersion,
        cancelableStatuses,
        { status: "CANCELLED" },
      );
      if (!written) throw new ConflictException("REQUEST_VERSION_CONFLICT");
      return toLearningRequestOwnerDetail({
        ...snapshot,
        status: "CANCELLED",
        version: snapshot.version + 1,
        updatedAt: now,
      });
    });
  }
}
