import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { LearningRequestRecord } from "../contracts/learning-request.types";
import {
  LEARNING_REQUEST_REPOSITORY,
  type LearningRequestRepository,
} from "../ports/learning-request-repository";

const startableStatuses = ["OPEN"] as const;

@Injectable()
export class LearningRequestLifecycleService {
  constructor(
    @Inject(LEARNING_REQUEST_REPOSITORY)
    private readonly repository: LearningRequestRepository,
  ) {}
  async proposalSource(tx: TransactionContext, id: string) {
    const row = await this.repository.get(tx, id);
    if (!row) throw new NotFoundException();
    return { ownerId: row.ownerId, skillId: row.skillId };
  }

  async lockForProposal(
    tx: TransactionContext,
    requestId: string,
    proposerId: string,
  ): Promise<{
    requestId: string;
    ownerId: string;
    skillId: string;
    verifiedTeacherOnly: boolean;
    version: number;
  }> {
    const request = await this.repository.lock(tx, requestId);
    if (!request) throw new NotFoundException();
    const now = await this.repository.databaseNow(tx);
    if (
      request.status !== "OPEN" ||
      (request.expiresAt !== null && request.expiresAt <= now) ||
      request.ownerId === proposerId
    ) {
      throw new ConflictException("REQUEST_NOT_AVAILABLE");
    }
    return {
      requestId: request.id,
      ownerId: request.ownerId,
      skillId: request.skillId,
      verifiedTeacherOnly: request.verifiedTeacherOnly,
      version: request.version,
    };
  }

  async beginNegotiation(
    tx: TransactionContext,
    requestId: string,
    expectedVersion: number,
  ): Promise<void> {
    const request = await this.lockExpected(
      tx,
      requestId,
      expectedVersion,
      startableStatuses,
    );
    const now = await this.repository.databaseNow(tx);
    if (request.expiresAt !== null && request.expiresAt <= now) {
      throw new ConflictException("REQUEST_EXPIRED");
    }
    await this.writeTransition(
      tx,
      request,
      expectedVersion,
      startableStatuses,
      {
        status: "NEGOTIATING",
      },
    );
  }

  async markMatched(
    tx: TransactionContext,
    requestId: string,
    expectedVersion: number,
  ): Promise<void> {
    const request = await this.lockExpected(tx, requestId, expectedVersion, [
      "NEGOTIATING",
    ]);
    await this.writeTransition(tx, request, expectedVersion, ["NEGOTIATING"], {
      status: "MATCHED",
    });
  }

  async markClosed(
    tx: TransactionContext,
    requestId: string,
    expectedVersion: number,
  ): Promise<void> {
    const request = await this.lockExpected(tx, requestId, expectedVersion, [
      "MATCHED",
    ]);
    await this.writeTransition(tx, request, expectedVersion, ["MATCHED"], {
      status: "CLOSED",
    });
  }

  private async lockExpected(
    tx: TransactionContext,
    requestId: string,
    expectedVersion: number,
    statuses: readonly LearningRequestRecord["status"][],
  ): Promise<LearningRequestRecord> {
    const request = await this.repository.lock(tx, requestId);
    if (!request) throw new NotFoundException();
    if (
      request.version !== expectedVersion ||
      !statuses.includes(request.status)
    ) {
      throw new ConflictException("REQUEST_VERSION_CONFLICT");
    }
    return request;
  }

  private async writeTransition(
    tx: TransactionContext,
    request: LearningRequestRecord,
    expectedVersion: number,
    statuses: readonly LearningRequestRecord["status"][],
    update: { status: LearningRequestRecord["status"] },
  ): Promise<void> {
    const written = await this.repository.transition(
      tx,
      request.id,
      expectedVersion,
      statuses,
      update,
    );
    if (!written) throw new ConflictException("REQUEST_VERSION_CONFLICT");
  }
}
