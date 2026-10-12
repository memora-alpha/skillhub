import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { lockUsers } from "../../../../shared/database/identity-transactions";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { Principal } from "../../../auth/application/services/sessions.service";
import {
  toLearningRequestModerationDetail,
  toLearningRequestCardContent,
  toLearningRequestOwnerDetail,
  type LearningRequestDetail,
  type LearningRequestModerationDetail,
  type LearningRequestOwnerDetail,
  type LearningRequestRecord,
} from "../contracts/learning-request.types";
import {
  REQUEST_OWNER_READER,
  SHARING_SKILL_READER,
  type SharingSkillReader,
  SKILL_CATALOG_READER,
  type RequestOwnerReader,
  type SkillCatalogReader,
} from "../ports/learning-request-dependencies";
import {
  LEARNING_REQUEST_REPOSITORY,
  type LearningRequestRepository,
} from "../ports/learning-request-repository";
import { LearningRequestAccessService } from "../services/learning-request-access.service";

const readPermissions = [
  "learning-request:read",
  "learning-request:moderation:read",
] as const;
const reviewerRoles = new Set(["STAFF", "ADMIN"]);

function isExpired(record: LearningRequestRecord, now: Date): boolean {
  return (
    ["OPEN", "PENDING_MODERATION"].includes(record.status) &&
    record.expiresAt !== null &&
    record.expiresAt <= now
  );
}

type LearningRequestVisibleDetail =
  | LearningRequestDetail
  | LearningRequestModerationDetail
  | (LearningRequestOwnerDetail & {
      effectiveStatus: LearningRequestRecord["status"];
    });

@Injectable()
export class GetLearningRequestUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly access: LearningRequestAccessService,
    @Inject(LEARNING_REQUEST_REPOSITORY)
    private readonly repository: LearningRequestRepository,
    @Inject(SKILL_CATALOG_READER)
    private readonly catalog: SkillCatalogReader,
    @Inject(REQUEST_OWNER_READER)
    private readonly owners: RequestOwnerReader,
    @Inject(SHARING_SKILL_READER) private readonly sharing: SharingSkillReader,
  ) {}

  execute(
    actor: Principal,
    requestId: string,
  ): Promise<LearningRequestVisibleDetail> {
    return this.transactions.run(async (tx) => {
      await lockUsers(tx, [actor.userId]);
      const live = await this.access.assertAnyAction(
        tx,
        actor,
        readPermissions,
      );
      const request = await this.repository.get(tx, requestId);
      if (!request) throw new NotFoundException();
      const now = await this.repository.databaseNow(tx);

      if (
        request.ownerId === live.userId &&
        live.permissions.includes("learning-request:read")
      ) {
        return {
          ...toLearningRequestOwnerDetail(
            request,
            await this.readOfferings(tx, request),
          ),
          effectiveStatus: isExpired(request, now) ? "EXPIRED" : request.status,
        };
      }
      if (
        request.status === "PENDING_MODERATION" &&
        live.permissions.includes("learning-request:moderation:read") &&
        live.roles.some((role) => reviewerRoles.has(role))
      ) {
        if (isExpired(request, now)) throw new NotFoundException();
        return toLearningRequestModerationDetail(
          request,
          await this.readOfferings(tx, request),
        );
      }
      if (
        request.status !== "OPEN" ||
        isExpired(request, now) ||
        !live.permissions.includes("learning-request:read")
      ) {
        throw new NotFoundException();
      }
      return this.projectPublicDetail(tx, request);
    });
  }

  private async projectPublicDetail(
    tx: TransactionContext,
    request: LearningRequestRecord,
  ): Promise<LearningRequestDetail> {
    const selection = await this.catalog.readSelections(tx, {
      skillIds: [request.skillId],
      tagIds: request.tagLinks.map(({ tagId }) => tagId),
    });
    const skill = selection.skills.find(({ id }) => id === request.skillId);
    const tagById = new Map(selection.tags.map((tag) => [tag.id, tag]));
    const tags = request.tagLinks.map(({ tagId }) => tagById.get(tagId));
    const [owner] = await this.owners.readPublicOwners(tx, [request.ownerId]);
    if (!skill || !owner || tags.some((tag) => !tag)) {
      throw new ServiceUnavailableException(
        "Request catalog or owner projection unavailable",
      );
    }
    return {
      id: request.id,
      ...toLearningRequestCardContent(
        request,
        await this.readOfferings(tx, request),
      ),
      title: request.title,
      skill: { id: skill.id, name: skill.name },
      tags: tags.map((tag) => ({ id: tag!.id, label: tag!.label })),
      learningGoal: request.learningGoal,
      currentLevel: request.currentLevel,
      verifiedTeacherOnly: request.verifiedTeacherOnly,
      status: request.status,
      owner,
      createdAt: request.createdAt,
      expiresAt: request.expiresAt,
      description: request.description,
      preferredSlots: request.preferredSlots
        .map(({ startAt, endAt }) => ({ startAt, endAt }))
        .sort(
          (left, right) => left.startAt.getTime() - right.startAt.getTime(),
        ),
      version: request.version,
    };
  }
  private readOfferings(
    tx: TransactionContext,
    request: LearningRequestRecord,
  ) {
    const ids = (request.offeringLinks ?? []).map(
      (link) => link.sharingSkillId,
    );
    return ids.length
      ? this.sharing.readRequestOfferings(tx, ids)
      : Promise.resolve([]);
  }
}
