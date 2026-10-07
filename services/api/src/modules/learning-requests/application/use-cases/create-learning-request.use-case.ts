import { BadRequestException, Injectable, Inject } from "@nestjs/common";
import { lockUsers } from "../../../../shared/database/identity-transactions";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import {
  NEW_ACTIVITY_ELIGIBILITY_READER,
  SKILL_CATALOG_READER,
  type NewActivityEligibilityReader,
  type SkillCatalogReader,
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
import {
  prepareLearningRequestContent,
  type LearningRequestInput,
  type PreparedLearningRequestContent,
} from "../../domain/request-text.policy";

function assertSelection(
  selection: { skillId: string; tags: { id: string; label: string }[] },
  skillId: string,
  tagIds: readonly string[],
): void {
  const expected = [...tagIds].sort();
  const actual = selection.tags.map(({ id }) => id).sort();
  if (
    selection.skillId !== skillId ||
    expected.length !== actual.length ||
    expected.some((id, index) => id !== actual[index])
  ) {
    throw new BadRequestException("INVALID_REQUEST_INPUT");
  }
}

function assertFutureDates(
  content: PreparedLearningRequestContent,
  now: Date,
): void {
  if (
    content.requestedExpiresAt !== null &&
    content.requestedExpiresAt <= now
  ) {
    throw new BadRequestException("INVALID_REQUEST_INPUT");
  }
  if (
    content.preferredSlots.some(
      ({ startAt, endAt }) => startAt <= now || endAt <= startAt,
    )
  ) {
    throw new BadRequestException("INVALID_REQUEST_INPUT");
  }
}

@Injectable()
export class CreateLearningRequestUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly access: LearningRequestAccessService,
    @Inject(NEW_ACTIVITY_ELIGIBILITY_READER)
    private readonly eligibility: NewActivityEligibilityReader,
    @Inject(SKILL_CATALOG_READER)
    private readonly catalog: SkillCatalogReader,
    @Inject(LEARNING_REQUEST_REPOSITORY)
    private readonly repository: LearningRequestRepository,
  ) {}

  async execute(
    actor: Principal,
    input: LearningRequestInput,
  ): Promise<LearningRequestOwnerDetail> {
    const content = prepareLearningRequestContent(input, new Date());
    return this.transactions.run(async (tx) => {
      await lockUsers(tx, [actor.userId]);
      const live = await this.access.assertUserAction(
        tx,
        actor,
        "learning-request:create",
      );
      await this.eligibility.assertAllowed(
        tx,
        live.userId,
        "CREATE_LEARNING_REQUEST",
      );
      const selection = await this.catalog.assertActiveSelection(tx, {
        skillId: content.skillId,
        tagIds: content.tagIds,
      });
      assertSelection(selection, content.skillId, content.tagIds);
      assertFutureDates(content, await this.repository.databaseNow(tx));
      const record = await this.repository.create(tx, {
        ownerId: live.userId,
        skillId: content.skillId,
        title: content.title,
        description: content.description,
        learningGoal: content.learningGoal,
        currentLevel: content.currentLevel,
        verifiedTeacherOnly: content.verifiedTeacherOnly,
        tagIds: content.tagIds,
        preferredSlots: content.preferredSlots,
        requestedExpiresAt: content.requestedExpiresAt,
        expiryMode: content.requestedExpiresAt ? "CUSTOM" : "DEFAULT",
      });
      return toLearningRequestOwnerDetail(record);
    });
  }
}
