import {
  BadRequestException,
  ConflictException,
  Injectable,
  Inject,
  NotFoundException,
} from "@nestjs/common";
import { lockUsers } from "../../../../shared/database/identity-transactions";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { SystemConfigurationService } from "../../../system-configuration/application/system-configuration.service";
import {
  toLearningRequestOwnerDetail,
  type LearningRequestOwnerDetail,
  type LearningRequestRecord,
} from "../contracts/learning-request.types";
import {
  SKILL_CATALOG_READER,
  SHARING_SKILL_READER,
  type SharingSkillReader,
  type SkillCatalogReader,
} from "../ports/learning-request-dependencies";
import {
  LEARNING_REQUEST_REPOSITORY,
  type LearningRequestRepository,
} from "../ports/learning-request-repository";
import { LearningRequestAccessService } from "../services/learning-request-access.service";
import {
  prepareLearningRequestContent,
  validateExpiryAtPublish,
  type PreparedLearningRequestContent,
} from "../../domain/request-text.policy";
import { evaluateModeration } from "../../domain/moderation.policy";
import {
  formatHourlyCredit,
  type PreferredAvailability,
} from "../../domain/request-preferences.policy";

const moderationKey = "learningRequest.moderationRuleSet" as const;
const editableStatuses = [
  "DRAFT",
  "OPEN",
  "PENDING_MODERATION",
  "REJECTED",
] as const;
type EditableStatus = (typeof editableStatuses)[number];

type EditInput = {
  teachingOverview?: string | null;
  preferredAvailability?: PreferredAvailability | null;
  desiredCreditPerHour?: string | null;
  offeredSharingSkillIds?: string[];
  expectedVersion: number;
  title?: string;
  skillId?: string;
  description?: string;
  learningGoal?: string;
  currentLevel?: "NONE" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  verifiedTeacherOnly?: boolean;
  tagIds?: string[];
  preferredSlots?: { startAt: string; endAt: string }[];
  expiresAt?: string | null;
};

type Snapshot = {
  request: LearningRequestRecord;
  content: PreparedLearningRequestContent;
  tags: { id: string; label: string }[];
  configVersion?: number;
  ruleSet?: unknown;
};

function assertExpectedVersion(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new BadRequestException("INVALID_REQUEST_INPUT");
  }
}

function assertOwnerAndEditable(
  request: LearningRequestRecord | null,
  actorId: string,
  expectedVersion: number,
): asserts request is LearningRequestRecord {
  if (request?.ownerId !== actorId) throw new NotFoundException();
  if (
    request.version !== expectedVersion ||
    !editableStatuses.includes(request.status as EditableStatus)
  ) {
    throw new ConflictException("REQUEST_VERSION_CONFLICT");
  }
}

function assertSelection(
  selection: { skillId: string; tags: { id: string; label: string }[] },
  content: PreparedLearningRequestContent,
): void {
  const expected = [...content.tagIds].sort((left, right) =>
    left.localeCompare(right),
  );
  const actual = selection.tags
    .map(({ id }) => id)
    .sort((left, right) => left.localeCompare(right));
  if (
    selection.skillId !== content.skillId ||
    expected.length !== actual.length ||
    expected.some((id, index) => id !== actual[index])
  ) {
    throw new BadRequestException("INVALID_REQUEST_INPUT");
  }
}

function sameTags(
  left: readonly { id: string; label: string }[],
  right: readonly { id: string; label: string }[],
): boolean {
  const key = ({ id, label }: { id: string; label: string }) =>
    `${id}\u0000${label}`;
  return (
    left
      .map(key)
      .sort((a, b) => a.localeCompare(b))
      .join("\u0001") ===
    right
      .map(key)
      .sort((a, b) => a.localeCompare(b))
      .join("\u0001")
  );
}

function mergedInput(
  request: LearningRequestRecord,
  input: EditInput,
): Record<string, unknown> {
  return {
    title: input.title ?? request.title,
    skillId: input.skillId ?? request.skillId,
    description: input.description ?? request.description,
    learningGoal: input.learningGoal ?? request.learningGoal,
    teachingOverview:
      input.teachingOverview === undefined
        ? (request.teachingOverview ?? null)
        : input.teachingOverview,
    desiredCreditPerHour:
      input.desiredCreditPerHour === undefined
        ? formatHourlyCredit(request.desiredCreditPerHour)
        : input.desiredCreditPerHour,
    offeredSharingSkillIds:
      input.offeredSharingSkillIds ??
      (request.offeringLinks ?? []).map((link) => link.sharingSkillId),
    preferredAvailability:
      input.preferredAvailability !== undefined
        ? input.preferredAvailability
        : input.preferredSlots?.length
          ? null
          : (request.preferredAvailability ?? null),
    currentLevel:
      input.currentLevel === undefined
        ? request.currentLevel
        : input.currentLevel,
    verifiedTeacherOnly:
      input.verifiedTeacherOnly ?? request.verifiedTeacherOnly,
    tagIds: input.tagIds ?? request.tagLinks.map(({ tagId }) => tagId),
    preferredSlots:
      input.preferredSlots ??
      (input.preferredAvailability?.weeklySlots.length
        ? []
        : request.preferredSlots.map(({ startAt, endAt }) => ({
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
          }))),
    expiresAt:
      input.expiresAt === undefined
        ? (request.requestedExpiresAt?.toISOString() ?? null)
        : input.expiresAt,
  };
}

function assertFutureSlots(
  content: PreparedLearningRequestContent,
  now: Date,
  supplied: boolean,
): void {
  if (
    supplied &&
    content.preferredSlots.some(
      ({ startAt, endAt }) => startAt <= now || endAt <= startAt,
    )
  ) {
    throw new BadRequestException("INVALID_REQUEST_INPUT");
  }
}

function changed(
  request: LearningRequestRecord,
  content: PreparedLearningRequestContent,
): boolean {
  const requestTags = request.tagLinks
    .map(({ tagId }) => tagId)
    .sort((left, right) => left.localeCompare(right));
  const contentTags = [...content.tagIds].sort((left, right) =>
    left.localeCompare(right),
  );
  const requestSlots = request.preferredSlots
    .map(
      ({ startAt, endAt }) => `${startAt.toISOString()}|${endAt.toISOString()}`,
    )
    .sort((left, right) => left.localeCompare(right));
  const contentSlots = content.preferredSlots
    .map(
      ({ startAt, endAt }) => `${startAt.toISOString()}|${endAt.toISOString()}`,
    )
    .sort((left, right) => left.localeCompare(right));
  return (
    request.title !== content.title ||
    request.skillId !== content.skillId ||
    request.description !== content.description ||
    request.learningGoal !== content.learningGoal ||
    (request.teachingOverview ?? null) !== content.teachingOverview ||
    (request.desiredCreditPerHour ?? null) !== content.desiredCreditPerHour ||
    JSON.stringify(request.preferredAvailability ?? null) !==
      JSON.stringify(content.preferredAvailability) ||
    (request.offeringLinks ?? [])
      .map((link) => link.sharingSkillId)
      .sort()
      .join("|") !== content.offeredSharingSkillIds.join("|") ||
    request.currentLevel !== content.currentLevel ||
    request.verifiedTeacherOnly !== content.verifiedTeacherOnly ||
    requestTags.join("|") !== contentTags.join("|") ||
    requestSlots.join("|") !== contentSlots.join("|") ||
    request.expiryMode !==
      (content.requestedExpiresAt ? "CUSTOM" : "DEFAULT") ||
    (request.requestedExpiresAt?.getTime() ?? null) !==
      (content.requestedExpiresAt?.getTime() ?? null)
  );
}

function assertNotExpired(request: LearningRequestRecord, now: Date): void {
  if (
    ["OPEN", "PENDING_MODERATION"].includes(request.status) &&
    request.expiresAt !== null &&
    request.expiresAt <= now
  ) {
    throw new ConflictException("REQUEST_EXPIRED");
  }
}

function nextExpiresAt(
  request: LearningRequestRecord,
  content: PreparedLearningRequestContent,
  expiresAtSupplied: boolean,
  published: boolean,
  now: Date,
): Date | null {
  let expiresAt = request.expiresAt;
  if (request.publishedAt === null) {
    expiresAt = null;
  } else if (expiresAtSupplied) {
    expiresAt = content.requestedExpiresAt ?? request.expiresAt;
  }
  if (published && request.publishedAt) {
    expiresAt = validateExpiryAtPublish(
      content.requestedExpiresAt,
      request.publishedAt,
    );
    if (expiresAt <= now)
      throw new BadRequestException("INVALID_REQUEST_INPUT");
  }
  return expiresAt;
}

function nextStatus(
  request: LearningRequestRecord,
  published: boolean,
  flagged: boolean,
): LearningRequestRecord["status"] {
  if (request.status === "REJECTED") return "DRAFT";
  if (flagged) return "PENDING_MODERATION";
  return published ? "OPEN" : "DRAFT";
}

@Injectable()
export class EditLearningRequestUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly access: LearningRequestAccessService,
    @Inject(SKILL_CATALOG_READER)
    private readonly catalog: SkillCatalogReader,
    @Inject(LEARNING_REQUEST_REPOSITORY)
    private readonly repository: LearningRequestRepository,
    private readonly configuration: SystemConfigurationService,
    @Inject(SHARING_SKILL_READER) private readonly sharing: SharingSkillReader,
  ) {}

  async execute(
    actor: Principal,
    requestId: string,
    input: EditInput,
  ): Promise<LearningRequestOwnerDetail> {
    assertExpectedVersion(input.expectedVersion);
    if (!Object.keys(input).some((key) => key !== "expectedVersion")) {
      throw new BadRequestException("INVALID_REQUEST_INPUT");
    }
    const snapshot = await this.readSnapshot(actor, requestId, input);
    const published =
      snapshot.request.status === "OPEN" ||
      snapshot.request.status === "PENDING_MODERATION";
    const moderation = published
      ? evaluateModeration(
          {
            title: snapshot.content.title,
            description: snapshot.content.description,
            learningGoal: snapshot.content.learningGoal,
            teachingOverview: snapshot.content.teachingOverview,
            tags: snapshot.tags.map(({ label }) => label),
          },
          { ruleSet: snapshot.ruleSet, version: snapshot.configVersion! },
        )
      : null;

    return this.transactions.run(async (tx) => {
      await lockUsers(tx, [actor.userId]);
      const live = await this.access.assertUserAction(
        tx,
        actor,
        "learning-request:update:self",
      );
      const current = await this.repository.lock(tx, requestId);
      assertOwnerAndEditable(current, live.userId, input.expectedVersion);
      if (current.status !== snapshot.request.status) {
        throw new ConflictException("REQUEST_VERSION_CONFLICT");
      }
      const currentSnapshot = { ...current };
      const now = await this.repository.databaseNow(tx);
      assertNotExpired(current, now);
      await this.assertSnapshotCurrent(tx, current, snapshot, published);
      if (snapshot.content.offeredSharingSkillIds.length > 0)
        await this.sharing.assertRequestOfferings(
          tx,
          live.userId,
          snapshot.content.offeredSharingSkillIds,
        );

      const expiryMode = snapshot.content.requestedExpiresAt
        ? "CUSTOM"
        : "DEFAULT";
      const expiresAt = nextExpiresAt(
        current,
        snapshot.content,
        input.expiresAt !== undefined,
        published,
        now,
      );
      const status = nextStatus(
        current,
        published,
        moderation?.flagged ?? false,
      );
      const nextModerationStatus =
        status === "PENDING_MODERATION" ? "PENDING" : "NOT_REQUIRED";
      const fields = {
        skillId: snapshot.content.skillId,
        title: snapshot.content.title,
        description: snapshot.content.description,
        learningGoal: snapshot.content.learningGoal,
        teachingOverview: snapshot.content.teachingOverview,
        preferredAvailability: snapshot.content.preferredAvailability,
        desiredCreditPerHour: snapshot.content.desiredCreditPerHour,
        offeredSharingSkillIds: snapshot.content.offeredSharingSkillIds,
        currentLevel: snapshot.content.currentLevel,
        verifiedTeacherOnly: snapshot.content.verifiedTeacherOnly,
        requestedExpiresAt: snapshot.content.requestedExpiresAt,
        expiryMode,
        expiresAt,
        status,
        moderationStatus: nextModerationStatus,
        moderationRejectReason: null,
        flaggedCategories: moderation?.categories ?? [],
        moderationRuleSetVersion: moderation?.ruleSetVersion ?? null,
        moderationReviewedVersion: null,
        moderatedByUserId: null,
        moderatedAt: null,
        tagIds: snapshot.content.tagIds,
        preferredSlots: snapshot.content.preferredSlots,
      } as const;
      if (
        !changed(current, snapshot.content) &&
        current.status !== "REJECTED"
      ) {
        throw new BadRequestException("INVALID_REQUEST_INPUT");
      }
      const written = await this.repository.replaceContent(
        tx,
        requestId,
        input.expectedVersion,
        fields,
      );
      if (!written) throw new ConflictException("REQUEST_VERSION_CONFLICT");
      return toLearningRequestOwnerDetail(
        {
          ...currentSnapshot,
          ...fields,
          preferredSlots: snapshot.content.preferredSlots,
          tagLinks: snapshot.content.tagIds.map((tagId) => ({ tagId })),
          offeringLinks: snapshot.content.offeredSharingSkillIds.map(
            (sharingSkillId) => ({ sharingSkillId }),
          ),
          version: currentSnapshot.version + 1,
          updatedAt: now,
        },
        snapshot.content.offeredSharingSkillIds.length
          ? await this.sharing.readRequestOfferings(
              tx,
              snapshot.content.offeredSharingSkillIds,
            )
          : [],
      );
    });
  }

  private async assertSnapshotCurrent(
    tx: TransactionContext,
    current: LearningRequestRecord,
    snapshot: Snapshot,
    published: boolean,
  ): Promise<void> {
    if (
      current.publishedAt !== null &&
      current.skillId !== snapshot.content.skillId
    ) {
      throw new ConflictException("PUBLISHED_SKILL_IMMUTABLE");
    }
    const currentSelection = await this.catalog.assertActiveSelection(tx, {
      skillId: snapshot.content.skillId,
      tagIds: snapshot.content.tagIds,
    });
    assertSelection(currentSelection, snapshot.content);
    if (!sameTags(currentSelection.tags, snapshot.tags)) {
      throw new ConflictException("Catalog labels changed; retry edit");
    }
    if (published) {
      const currentConfig = await this.configuration.getSnapshot(
        [moderationKey],
        tx,
      );
      if (currentConfig.versions[moderationKey] !== snapshot.configVersion) {
        throw new ConflictException("Moderation rules changed; retry edit");
      }
    }
  }

  private readSnapshot(
    actor: Principal,
    requestId: string,
    input: EditInput,
  ): Promise<Snapshot> {
    return this.transactions.run(async (tx) => {
      await lockUsers(tx, [actor.userId]);
      const live = await this.access.assertUserAction(
        tx,
        actor,
        "learning-request:update:self",
      );
      const request = await this.repository.get(tx, requestId);
      assertOwnerAndEditable(request, live.userId, input.expectedVersion);
      const now = await this.repository.databaseNow(tx);
      assertNotExpired(request, now);
      const raw = mergedInput(request, input);
      const content = prepareLearningRequestContent(raw, new Date(0));
      if (
        content.requestedExpiresAt !== null &&
        content.requestedExpiresAt <= now
      ) {
        throw new BadRequestException("INVALID_REQUEST_INPUT");
      }
      assertFutureSlots(content, now, input.preferredSlots !== undefined);
      if (
        request.publishedAt !== null &&
        input.skillId !== undefined &&
        input.skillId !== request.skillId
      ) {
        throw new ConflictException("PUBLISHED_SKILL_IMMUTABLE");
      }
      if (!changed(request, content) && request.status !== "REJECTED") {
        throw new BadRequestException("INVALID_REQUEST_INPUT");
      }
      const selection = await this.catalog.assertActiveSelection(tx, {
        skillId: content.skillId,
        tagIds: content.tagIds,
      });
      assertSelection(selection, content);
      const snapshot: Snapshot = {
        request,
        content,
        tags: selection.tags.map(({ id, label }) => ({ id, label })),
      };
      if (
        request.status === "OPEN" ||
        request.status === "PENDING_MODERATION"
      ) {
        const config = await this.configuration.getSnapshot(
          [moderationKey],
          tx,
        );
        snapshot.configVersion = config.versions[moderationKey];
        snapshot.ruleSet = config.values[moderationKey];
      }
      return snapshot;
    });
  }
}
