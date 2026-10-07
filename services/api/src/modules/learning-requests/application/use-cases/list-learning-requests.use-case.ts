import { createHash } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { lockUsers } from "../../../../shared/database/identity-transactions";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { Principal } from "../../../auth/application/services/sessions.service";
import type {
  LearningRequestListQuery,
  LearningRequestListScope,
  LearningRequestModerationDetail,
  LearningRequestOwnerSummary,
  LearningRequestRecord,
  LearningRequestSummary,
} from "../contracts/learning-request.types";
import {
  toLearningRequestModerationDetail,
  toLearningRequestOwnerDetail,
} from "../contracts/learning-request.types";
import {
  REQUEST_OWNER_READER,
  SHARING_SKILL_READER,
  SKILL_CATALOG_READER,
  type RequestOwnerReader,
  type SharingSkillReader,
  type SkillCatalogReader,
} from "../ports/learning-request-dependencies";
import {
  LEARNING_REQUEST_REPOSITORY,
  type LearningRequestPageFilter,
  type LearningRequestRepository,
  type LearningRequestRecommendationFilter,
} from "../ports/learning-request-repository";
import { LearningRequestAccessService } from "../services/learning-request-access.service";
import { sanitizeLearningRequestText } from "../../domain/request-text.policy";

const allStatuses = [
  "DRAFT",
  "PENDING_MODERATION",
  "OPEN",
  "REJECTED",
  "NEGOTIATING",
  "MATCHED",
  "CLOSED",
  "CANCELLED",
  "EXPIRED",
] as const;
const reviewerRoles = new Set(["STAFF", "ADMIN"]);
const defaultLimit = 20;
const maxLimit = 100;
const maxKeywordLength = 120;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NormalizedQuery = {
  skillId?: string;
  tagIds: string[];
  keyword?: string;
  status?: (typeof allStatuses)[number];
  limit: number;
  cursor?: string;
};
type RequestCursor = {
  scope: LearningRequestListScope;
  actorId: string;
  filterHash: string;
  id: string;
  createdAt: string;
  matchingVersion?: string;
  matchScore?: number;
};
type PageItem =
  | LearningRequestSummary
  | LearningRequestOwnerSummary
  | LearningRequestModerationDetail
  | (LearningRequestSummary & { matchScore: number });
type Page = { items: PageItem[]; nextCursor: string | null };

function normalizeQuery(input: LearningRequestListQuery): NormalizedQuery {
  const limit = input.limit ?? defaultLimit;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new BadRequestException("INVALID_REQUEST_QUERY");
  }
  if (input.skillId !== undefined && !uuid.test(input.skillId)) {
    throw new BadRequestException("INVALID_REQUEST_QUERY");
  }
  const tagIds = input.tagIds ?? [];
  if (
    !Array.isArray(tagIds) ||
    tagIds.length > 10 ||
    tagIds.some((id) => !uuid.test(id)) ||
    new Set(tagIds).size !== tagIds.length
  ) {
    throw new BadRequestException("INVALID_REQUEST_QUERY");
  }
  let keyword: string | undefined;
  if (input.keyword !== undefined) {
    if (typeof input.keyword !== "string")
      throw new BadRequestException("INVALID_REQUEST_QUERY");
    keyword = sanitizeLearningRequestText(input.keyword);
    if ([...keyword].length > maxKeywordLength)
      throw new BadRequestException("INVALID_REQUEST_QUERY");
    if (keyword.length === 0) keyword = undefined;
  }
  if (
    input.status !== undefined &&
    !allStatuses.includes(input.status as (typeof allStatuses)[number])
  ) {
    throw new BadRequestException("INVALID_REQUEST_QUERY");
  }
  if (
    input.cursor !== undefined &&
    (typeof input.cursor !== "string" || input.cursor.length > 1024)
  ) {
    throw new BadRequestException("INVALID_REQUEST_QUERY");
  }
  return {
    ...(input.skillId ? { skillId: input.skillId } : {}),
    tagIds: [...tagIds].sort(),
    ...(keyword ? { keyword } : {}),
    ...(input.status
      ? { status: input.status as (typeof allStatuses)[number] }
      : {}),
    limit,
    ...(input.cursor ? { cursor: input.cursor } : {}),
  };
}

function filterHash(
  scope: LearningRequestListScope,
  query: NormalizedQuery,
): string {
  const filters = {
    skillId: query.skillId,
    tagIds: query.tagIds,
    keyword: query.keyword,
    status: query.status,
  };
  return createHash("sha256")
    .update(JSON.stringify({ scope, filters }))
    .digest("hex");
}

function decodeCursor(
  value: string | undefined,
  scope: LearningRequestListScope,
  actorId: string,
  expectedHash: string,
  matchingVersion?: string,
): RequestCursor | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as RequestCursor;
    const createdAt = new Date(decoded.createdAt);
    if (
      decoded.scope !== scope ||
      decoded.actorId !== actorId ||
      decoded.filterHash !== expectedHash ||
      !uuid.test(decoded.id) ||
      !Number.isFinite(createdAt.getTime()) ||
      (scope === "RECOMMENDED" &&
        (decoded.matchingVersion !== matchingVersion ||
          !Number.isSafeInteger(decoded.matchScore) ||
          (decoded.matchScore ?? -1) < 0))
    ) {
      throw new Error("cursor mismatch");
    }
    return decoded;
  } catch {
    throw new BadRequestException("INVALID_REQUEST_CURSOR");
  }
}

function encodeCursor(cursor: RequestCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function assertReviewer(actor: Principal): void {
  if (!actor.roles.some((role) => reviewerRoles.has(role)))
    throw new ForbiddenException();
}

function effectiveStatus(
  record: LearningRequestRecord,
  now: Date,
): LearningRequestRecord["status"] {
  return ["OPEN", "PENDING_MODERATION"].includes(record.status) &&
    record.expiresAt !== null &&
    record.expiresAt <= now
    ? "EXPIRED"
    : record.status;
}

function projectSummary(
  record: LearningRequestRecord,
  skill: { id: string; name: string },
  tags: { id: string; label: string }[],
  owner: { id: string; displayName: string },
): LearningRequestSummary {
  return {
    id: record.id,
    title: record.title,
    skill,
    tags,
    learningGoal: record.learningGoal,
    currentLevel: record.currentLevel,
    verifiedTeacherOnly: record.verifiedTeacherOnly,
    status: record.status,
    owner,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}

@Injectable()
export class ListLearningRequestsUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly access: LearningRequestAccessService,
    @Inject(LEARNING_REQUEST_REPOSITORY)
    private readonly repository: LearningRequestRepository,
    @Inject(SKILL_CATALOG_READER)
    private readonly catalog: SkillCatalogReader,
    @Inject(REQUEST_OWNER_READER)
    private readonly owners: RequestOwnerReader,
    @Inject(SHARING_SKILL_READER)
    private readonly sharing: SharingSkillReader,
  ) {}

  async execute(
    actor: Principal,
    scope: LearningRequestListScope,
    input: LearningRequestListQuery,
  ): Promise<Page> {
    const query = normalizeQuery(input);
    if (
      (scope === "FEED" || scope === "RECOMMENDED") &&
      query.status !== undefined &&
      query.status !== "OPEN"
    ) {
      throw new BadRequestException("INVALID_REQUEST_QUERY");
    }
    if (
      scope === "MODERATION" &&
      query.status !== undefined &&
      query.status !== "PENDING_MODERATION"
    ) {
      throw new BadRequestException("INVALID_REQUEST_QUERY");
    }

    return this.transactions.run(async (tx) => {
      await lockUsers(tx, [actor.userId]);
      const permission =
        scope === "MODERATION"
          ? "learning-request:moderation:read"
          : "learning-request:read";
      const live = await this.access.assertAction(tx, actor, permission);
      if (scope === "MODERATION") assertReviewer(live);
      const now = await this.repository.databaseNow(tx);
      let matchingVersion: string | undefined;
      let recommendedInput: LearningRequestRecommendationFilter | undefined;
      if (scope === "RECOMMENDED") {
        const matching = await this.sharing.getMatchingSnapshot(
          tx,
          live.userId,
        );
        matchingVersion = matching.version;
        recommendedInput = {
          candidateSkillIds: matching.skillIds,
          candidateTagIds: matching.tagIds,
          excludeOwnerId: live.userId,
          skillId: query.skillId,
          tagIds: query.tagIds,
          keyword: query.keyword,
          now,
          after: null,
          take: query.limit + 1,
        };
      }
      const hash = filterHash(scope, query);
      const cursor = decodeCursor(
        query.cursor,
        scope,
        live.userId,
        hash,
        matchingVersion,
      );
      const expiredOwnerFilter = scope === "MINE" && query.status === "EXPIRED";
      const requestStatuses =
        scope === "MINE"
          ? query.status
            ? expiredOwnerFilter
              ? (["EXPIRED", "OPEN", "PENDING_MODERATION"] as const)
              : [query.status]
            : allStatuses
          : scope === "MODERATION"
            ? ["PENDING_MODERATION" as const]
            : ["OPEN" as const];
      const filter: LearningRequestPageFilter = {
        statuses: requestStatuses,
        ...(scope === "MINE" ? { ownerId: live.userId } : {}),
        ...(query.skillId ? { skillId: query.skillId } : {}),
        tagIds: query.tagIds,
        ...(query.keyword ? { keyword: query.keyword } : {}),
        ...(scope !== "MINE" ||
        ["OPEN", "PENDING_MODERATION"].includes(query.status ?? "")
          ? { now }
          : {}),
        ...(expiredOwnerFilter ? { expiredAtOrBefore: now } : {}),
        after: cursor
          ? { createdAt: new Date(cursor.createdAt), id: cursor.id }
          : null,
        take: query.limit + 1,
      };

      const candidates = recommendedInput
        ? await this.repository.findRecommended(tx, {
            ...recommendedInput,
            after: cursor
              ? {
                  matchScore: cursor.matchScore!,
                  createdAt: new Date(cursor.createdAt),
                  id: cursor.id,
                }
              : null,
          })
        : (await this.repository.findPage(tx, filter)).map((request) => ({
            request,
            matchScore: undefined,
          }));
      const hasMore = candidates.length > query.limit;
      const pageCandidates = candidates.slice(0, query.limit);
      const records = pageCandidates.map(({ request }) => request);
      let items: PageItem[];
      if (scope === "MINE") {
        items = records.map((record) => ({
          ...toLearningRequestOwnerDetail(record),
          effectiveStatus: effectiveStatus(record, now),
        }));
      } else if (scope === "MODERATION") {
        items = records.map(toLearningRequestModerationDetail);
      } else {
        items = await this.projectPublicItems(
          tx,
          records,
          pageCandidates.map(({ matchScore }) => matchScore),
        );
      }
      const last = pageCandidates.at(-1);
      return {
        items,
        nextCursor:
          hasMore && last
            ? encodeCursor({
                scope,
                actorId: live.userId,
                filterHash: hash,
                id: last.request.id,
                createdAt: last.request.createdAt.toISOString(),
                ...(matchingVersion ? { matchingVersion } : {}),
                ...(last.matchScore !== undefined
                  ? { matchScore: last.matchScore }
                  : {}),
              })
            : null,
      };
    });
  }

  private async projectPublicItems(
    tx: TransactionContext,
    records: LearningRequestRecord[],
    scores: (number | undefined)[],
  ): Promise<PageItem[]> {
    if (records.length === 0) return [];
    const selection = await this.catalog.readSelections(tx, {
      skillIds: [...new Set(records.map(({ skillId }) => skillId))],
      tagIds: [
        ...new Set(
          records.flatMap(({ tagLinks }) => tagLinks.map(({ tagId }) => tagId)),
        ),
      ],
    });
    const owners = await this.owners.readPublicOwners(tx, [
      ...new Set(records.map(({ ownerId }) => ownerId)),
    ]);
    const skills = new Map(selection.skills.map((skill) => [skill.id, skill]));
    const tags = new Map(selection.tags.map((tag) => [tag.id, tag]));
    const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
    return records.map((record, index) => {
      const skill = skills.get(record.skillId);
      const owner = ownerById.get(record.ownerId);
      const requestTags = record.tagLinks.map(({ tagId }) => tags.get(tagId));
      if (!skill || !owner || requestTags.some((tag) => !tag)) {
        throw new ServiceUnavailableException(
          "Request catalog or owner projection unavailable",
        );
      }
      const item = projectSummary(
        record,
        { id: skill.id, name: skill.name },
        requestTags.map((tag) => ({ id: tag!.id, label: tag!.label })),
        owner,
      );
      return scores[index] === undefined
        ? item
        : { ...item, matchScore: scores[index] };
    });
  }
}
