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
import { SystemConfigurationService } from "../../../system-configuration/application/system-configuration.service";
import type { LearningRequestRecord } from "../contracts/learning-request.types";
import {
  toLearningRequestOwnerDetail,
  type LearningRequestOwnerDetail,
} from "../contracts/learning-request.types";
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
import { LearningRequestAccessService } from "../services/learning-request-access.service";
import { evaluateModeration } from "../../domain/moderation.policy";
import { validateExpiryAtPublish } from "../../domain/request-text.policy";

const moderationKey = "learningRequest.moderationRuleSet" as const;

type Snapshot = {
  request: LearningRequestRecord;
  tags: { id: string; label: string }[];
  configVersion: number;
  ruleSet: unknown;
};

function signature(request: LearningRequestRecord): string {
  return JSON.stringify({
    skillId: request.skillId,
    title: request.title,
    description: request.description,
    learningGoal: request.learningGoal,
    currentLevel: request.currentLevel,
    verifiedTeacherOnly: request.verifiedTeacherOnly,
    tagIds: request.tagLinks.map(({ tagId }) => tagId).sort(),
    slots: request.preferredSlots
      .map(({ startAt, endAt }) => [startAt.toISOString(), endAt.toISOString()])
      .sort(([a], [b]) => String(a).localeCompare(String(b))),
    requestedExpiresAt: request.requestedExpiresAt?.toISOString() ?? null,
    expiryMode: request.expiryMode,
  });
}

function assertExpectedVersion(expectedVersion: number): void {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    throw new BadRequestException("INVALID_REQUEST_INPUT");
  }
}

function assertOwnerAndDraft(
  request: LearningRequestRecord | null,
  actorId: string,
  expectedVersion: number,
): asserts request is LearningRequestRecord {
  if (!request || request.ownerId !== actorId) throw new NotFoundException();
  if (request.status !== "DRAFT" || request.version !== expectedVersion) {
    throw new ConflictException("REQUEST_VERSION_CONFLICT");
  }
}

function assertSelection(
  selection: { skillId: string; tags: { id: string; label: string }[] },
  request: LearningRequestRecord,
): void {
  const expectedIds = request.tagLinks.map(({ tagId }) => tagId).sort();
  const actualIds = selection.tags.map(({ id }) => id).sort();
  if (
    selection.skillId !== request.skillId ||
    expectedIds.length !== actualIds.length ||
    expectedIds.some((id, index) => id !== actualIds[index])
  ) {
    throw new ConflictException("REQUEST_VERSION_CONFLICT");
  }
}

function sameTags(
  left: readonly { id: string; label: string }[],
  right: readonly { id: string; label: string }[],
): boolean {
  const key = (tag: { id: string; label: string }) =>
    `${tag.id}\u0000${tag.label}`;
  return (
    left.map(key).sort().join("\u0001") === right.map(key).sort().join("\u0001")
  );
}

@Injectable()
export class PublishLearningRequestUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly access: LearningRequestAccessService,
    @Inject(NEW_ACTIVITY_ELIGIBILITY_READER)
    private readonly eligibility: NewActivityEligibilityReader,
    @Inject(LEARNING_REQUEST_REPOSITORY)
    private readonly repository: LearningRequestRepository,
    @Inject(SKILL_CATALOG_READER)
    private readonly catalog: SkillCatalogReader,
    private readonly configuration: SystemConfigurationService,
  ) {}

  async execute(
    actor: Principal,
    requestId: string,
    input: { expectedVersion: number },
  ): Promise<LearningRequestOwnerDetail> {
    assertExpectedVersion(input.expectedVersion);
    const snapshot = await this.readSnapshot(
      actor,
      requestId,
      input.expectedVersion,
    );
    const moderation = evaluateModeration(
      {
        title: snapshot.request.title,
        description: snapshot.request.description,
        learningGoal: snapshot.request.learningGoal,
        tags: snapshot.tags.map(({ label }) => label),
      },
      { ruleSet: snapshot.ruleSet, version: snapshot.configVersion },
    );

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
        "PUBLISH_LEARNING_REQUEST",
      );
      const current = await this.repository.lock(tx, requestId);
      assertOwnerAndDraft(current, live.userId, input.expectedVersion);
      if (signature(current) !== signature(snapshot.request)) {
        throw new ConflictException("REQUEST_VERSION_CONFLICT");
      }
      const currentConfig = await this.configuration.getSnapshot(
        [moderationKey],
        tx,
      );
      if (currentConfig.versions[moderationKey] !== snapshot.configVersion) {
        throw new ConflictException("Moderation rules changed; retry publish");
      }
      const currentSelection = await this.catalog.assertActiveSelection(tx, {
        skillId: current.skillId,
        tagIds: current.tagLinks.map(({ tagId }) => tagId),
      });
      assertSelection(currentSelection, current);
      if (!sameTags(currentSelection.tags, snapshot.tags)) {
        throw new ConflictException("Catalog labels changed; retry publish");
      }
      const publishedAt = await this.repository.databaseNow(tx);
      if (
        current.preferredSlots.some(
          ({ startAt, endAt }) => startAt <= publishedAt || endAt <= startAt,
        )
      ) {
        throw new ConflictException("A preferred time has passed");
      }
      const expiresAt = validateExpiryAtPublish(
        current.requestedExpiresAt,
        publishedAt,
      );
      const transition = {
        status: moderation.flagged ? "PENDING_MODERATION" : "OPEN",
        moderationStatus: moderation.flagged ? "PENDING" : "NOT_REQUIRED",
        moderationRejectReason: null,
        flaggedCategories: moderation.categories,
        moderationRuleSetVersion: moderation.ruleSetVersion,
        moderationReviewedVersion: null,
        moderatedByUserId: null,
        moderatedAt: null,
        expiresAt,
        publishedAt,
      } as const;
      const written = await this.repository.transition(
        tx,
        requestId,
        input.expectedVersion,
        ["DRAFT"],
        transition,
      );
      if (!written) throw new ConflictException("REQUEST_VERSION_CONFLICT");
      return toLearningRequestOwnerDetail({
        ...current,
        ...transition,
        version: current.version + 1,
        updatedAt: publishedAt,
      });
    });
  }

  private readSnapshot(
    actor: Principal,
    requestId: string,
    expectedVersion: number,
  ): Promise<Snapshot> {
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
        "PUBLISH_LEARNING_REQUEST",
      );
      const request = await this.repository.get(tx, requestId);
      assertOwnerAndDraft(request, live.userId, expectedVersion);
      const selection = await this.catalog.assertActiveSelection(tx, {
        skillId: request.skillId,
        tagIds: request.tagLinks.map(({ tagId }) => tagId),
      });
      assertSelection(selection, request);
      const config = await this.configuration.getSnapshot([moderationKey], tx);
      return {
        request,
        tags: selection.tags.map(({ id, label }) => ({ id, label })),
        configVersion: config.versions[moderationKey],
        ruleSet: config.values[moderationKey],
      };
    });
  }
}
