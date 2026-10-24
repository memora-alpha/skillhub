import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { Prisma } from "../../../../generated/prisma/client";
import type {
  CreateLearningRequestRecord,
  LearningRequestRecord,
  LearningRequestTransition,
  ReplaceLearningRequestContent,
  PreferredSlotRecord,
} from "../../application/contracts/learning-request.types";
import type {
  LearningRequestPageFilter,
  LearningRequestRecommendationFilter,
  LearningRequestRepository,
} from "../../application/ports/learning-request-repository";
import type { LearningRequestStatus } from "../../../../generated/prisma/client";
import { preferredAvailabilitySchema } from "../../domain/request-preferences.policy";

const includeContent = { tagLinks: true, offeringLinks: true } as const;
type StoredLearningRequest = Prisma.LearningRequestGetPayload<{
  include: typeof includeContent;
}>;
const storedSlotsSchema = z
  .array(
    z
      .strictObject({
        startAt: z.iso.datetime({ offset: true }),
        endAt: z.iso.datetime({ offset: true }),
      })
      .refine((slot) => new Date(slot.endAt) > new Date(slot.startAt)),
  )
  .max(5);
const storedCategoriesSchema = z.array(z.string());

function toRecord(row: StoredLearningRequest): LearningRequestRecord {
  return {
    ...row,
    offeringLinks: row.offeringLinks ?? [],
    preferredAvailability:
      row.preferredAvailability == null
        ? null
        : preferredAvailabilitySchema.parse(row.preferredAvailability),
    preferredSlots: storedSlotsSchema.parse(row.preferredSlots).map((slot) => ({
      startAt: new Date(slot.startAt),
      endAt: new Date(slot.endAt),
    })),
    flaggedCategories: storedCategoriesSchema.parse(
      row.flaggedCategories ?? [],
    ),
  };
}

function serializeSlots(slots: readonly PreferredSlotRecord[]) {
  return slots.map(({ startAt, endAt }) => ({
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
  }));
}
const expiryStatuses: LearningRequestStatus[] = ["OPEN", "PENDING_MODERATION"];
const maxExpiryBatchSize = 500;
const maxPageSize = 101;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, String.raw`\$&`);
}

function uuidArray(values: readonly string[]): Prisma.Sql {
  if (values.length === 0) return Prisma.sql`ARRAY[]::uuid[]`;
  return Prisma.sql`ARRAY[${Prisma.join(
    values.map((value) => Prisma.sql`${value}::uuid`),
  )}]::uuid[]`;
}

@Injectable()
export class PrismaLearningRequestRepository implements LearningRequestRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: Pick<PrismaService, "learningRequest">,
  ) {}

  async databaseNow(tx: TransactionContext): Promise<Date> {
    const rows = await tx.$queryRaw<{ now: Date }[]>`
      SELECT CURRENT_TIMESTAMP AS now
    `;
    const timestamp = rows[0]?.now;
    if (!(timestamp instanceof Date) || !Number.isFinite(timestamp.getTime())) {
      throw new TypeError("database time unavailable");
    }
    return timestamp;
  }

  async get(
    tx: TransactionContext,
    requestId: string,
  ): Promise<LearningRequestRecord | null> {
    const row = await tx.learningRequest.findUnique({
      where: { id: requestId },
      include: includeContent,
    });
    return row ? toRecord(row) : null;
  }

  async lock(
    tx: TransactionContext,
    requestId: string,
  ): Promise<LearningRequestRecord | null> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT request_id AS id
      FROM learning_requests
      WHERE request_id = ${requestId}::uuid
      FOR UPDATE
    `;
    if (rows.length === 0) return null;
    return this.get(tx, requestId);
  }

  async create(
    tx: TransactionContext,
    input: CreateLearningRequestRecord,
  ): Promise<LearningRequestRecord> {
    const row = await tx.learningRequest.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        ownerId: input.ownerId,
        skillId: input.skillId,
        title: input.title,
        description: input.description,
        learningGoal: input.learningGoal,
        teachingOverview: input.teachingOverview ?? null,
        preferredAvailability: input.preferredAvailability ?? Prisma.DbNull,
        desiredCreditPerHour: input.desiredCreditPerHour ?? null,
        offeringLinks: {
          create: (input.offeredSharingSkillIds ?? []).map(
            (sharingSkillId) => ({
              sharingSkill: { connect: { id: sharingSkillId } },
            }),
          ),
        },
        currentLevel: input.currentLevel,
        verifiedTeacherOnly: input.verifiedTeacherOnly,
        proposedTags: [...(input.proposedTags ?? [])],
        requestedExpiresAt: input.requestedExpiresAt,
        expiryMode: input.expiryMode,
        preferredSlots: serializeSlots(input.preferredSlots),
        tagLinks: {
          create: input.tagIds.map((tagId) => ({
            tag: { connect: { id: tagId } },
          })),
        },
      },
      include: includeContent,
    });
    return toRecord(row);
  }

  async replaceContent(
    tx: TransactionContext,
    requestId: string,
    expectedVersion: number,
    content: ReplaceLearningRequestContent,
  ): Promise<boolean> {
    const {
      tagIds,
      preferredSlots,
      offeredSharingSkillIds,
      preferredAvailability,
      ...fields
    } = content;
    const result = await tx.learningRequest.updateMany({
      where: { id: requestId, version: expectedVersion },
      data: {
        ...fields,
        ...(preferredAvailability !== undefined
          ? { preferredAvailability: preferredAvailability ?? Prisma.DbNull }
          : {}),
        ...(preferredSlots !== undefined
          ? { preferredSlots: serializeSlots(preferredSlots) }
          : {}),
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) return false;

    if (offeredSharingSkillIds !== undefined) {
      await tx.requestOffering.deleteMany({ where: { requestId } });
      if (offeredSharingSkillIds.length > 0)
        await tx.requestOffering.createMany({
          data: offeredSharingSkillIds.map((sharingSkillId) => ({
            requestId,
            sharingSkillId,
          })),
        });
    }

    if (tagIds !== undefined) await this.replaceTags(tx, requestId, tagIds);
    return true;
  }

  async transition(
    tx: TransactionContext,
    requestId: string,
    expectedVersion: number,
    from: readonly LearningRequestStatus[],
    transition: LearningRequestTransition,
  ): Promise<boolean> {
    if (from.length === 0) throw new TypeError("transition source is required");
    const { tagIds, ...fields } = transition;
    const result = await tx.learningRequest.updateMany({
      where: {
        id: requestId,
        version: expectedVersion,
        status: { in: [...from] },
      },
      data: { ...fields, version: { increment: 1 } },
    });
    if (result.count !== 1) return false;
    if (tagIds !== undefined) await this.replaceTags(tx, requestId, tagIds);
    return true;
  }

  private async replaceTags(
    tx: TransactionContext,
    requestId: string,
    tagIds: readonly string[],
  ) {
    await tx.requestTag.deleteMany({ where: { requestId } });
    if (tagIds.length > 0) {
      await tx.requestTag.createMany({
        data: tagIds.map((tagId) => ({ requestId, tagId })),
      });
    }
  }

  findExpired(
    tx: TransactionContext,
    now: Date,
    batchSize: number,
  ): Promise<{ id: string; version: number }[]> {
    if (
      !Number.isSafeInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > maxExpiryBatchSize
    ) {
      return Promise.reject(
        new RangeError(`batchSize must be between 1 and ${maxExpiryBatchSize}`),
      );
    }
    return tx.learningRequest.findMany({
      where: { status: { in: expiryStatuses }, expiresAt: { lte: now } },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      take: batchSize,
      select: { id: true, version: true },
    });
  }

  async findPage(
    tx: TransactionContext,
    filter: LearningRequestPageFilter,
  ): Promise<LearningRequestRecord[]> {
    if (
      filter.statuses.length === 0 ||
      !Number.isSafeInteger(filter.take) ||
      filter.take < 1 ||
      filter.take > maxPageSize
    ) {
      throw new RangeError("invalid learning request page query");
    }
    const keyword = filter.keyword ? escapeLike(filter.keyword) : undefined;
    const where: Prisma.LearningRequestWhereInput = {
      status: { in: [...filter.statuses] },
      ...(filter.ownerId ? { ownerId: filter.ownerId } : {}),
      ...(filter.skillId ? { skillId: filter.skillId } : {}),
      ...(filter.tagIds.length > 0
        ? { tagLinks: { some: { tagId: { in: [...filter.tagIds] } } } }
        : {}),
      ...(keyword
        ? {
            OR: [
              { title: { contains: keyword, mode: "insensitive" as const } },
              {
                description: {
                  contains: keyword,
                  mode: "insensitive" as const,
                },
              },
              {
                learningGoal: {
                  contains: keyword,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
      ...(filter.now ? { expiresAt: { gt: filter.now } } : {}),
      ...(filter.after || filter.expiredAtOrBefore
        ? {
            AND: [
              ...(filter.expiredAtOrBefore
                ? [
                    {
                      OR: [
                        { status: "EXPIRED" as const },
                        {
                          status: { in: expiryStatuses },
                          expiresAt: { lte: filter.expiredAtOrBefore },
                        },
                      ],
                    },
                  ]
                : []),
              ...(filter.after
                ? [
                    {
                      OR: [
                        { createdAt: { lt: filter.after.createdAt } },
                        {
                          createdAt: filter.after.createdAt,
                          id: { lt: filter.after.id },
                        },
                      ],
                    },
                  ]
                : []),
            ],
          }
        : {}),
    };
    const rows = await tx.learningRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: filter.take,
      include: includeContent,
    });
    return rows.map(toRecord);
  }

  async findRecommended(
    tx: TransactionContext,
    filter: LearningRequestRecommendationFilter,
  ): Promise<{ request: LearningRequestRecord; matchScore: number }[]> {
    if (
      !Number.isSafeInteger(filter.take) ||
      filter.take < 1 ||
      filter.take > maxPageSize
    ) {
      throw new RangeError("invalid learning request recommendation query");
    }
    const skillIds = uuidArray(filter.candidateSkillIds);
    const candidateTagIds = uuidArray(filter.candidateTagIds);
    const skillSelection =
      filter.candidateSkillIds.length > 0
        ? Prisma.sql`lr."skill_id" = ANY(${skillIds})`
        : Prisma.sql`FALSE`;
    const tagSelection =
      filter.candidateTagIds.length > 0
        ? Prisma.sql`EXISTS (
          SELECT 1 FROM "learning_request_tags" selected_tag
          WHERE selected_tag."request_id" = lr."request_id"
            AND selected_tag."tag_id" = ANY(${candidateTagIds})
        )`
        : Prisma.sql`FALSE`;
    const skillFilter = filter.skillId
      ? Prisma.sql`AND lr."skill_id" = ${filter.skillId}::uuid`
      : Prisma.empty;
    const tagFilter =
      filter.tagIds.length > 0
        ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "learning_request_tags" filter_tag
          WHERE filter_tag."request_id" = lr."request_id"
            AND filter_tag."tag_id" IN (${Prisma.join(
              filter.tagIds.map((tagId) => Prisma.sql`${tagId}::uuid`),
            )})
        )`
        : Prisma.empty;
    const keywordFilter = filter.keyword
      ? Prisma.sql`AND POSITION(LOWER(${filter.keyword}) IN LOWER(CONCAT_WS(' ', lr."title", lr."description", lr."learning_goal"))) > 0`
      : Prisma.empty;
    const cursorFilter = filter.after
      ? Prisma.sql`WHERE match_score < ${filter.after.matchScore}
          OR (match_score = ${filter.after.matchScore} AND created_at < ${filter.after.createdAt})
          OR (match_score = ${filter.after.matchScore} AND created_at = ${filter.after.createdAt}
            AND request_id < ${filter.after.id}::uuid)`
      : Prisma.sql``;
    const ranked = await tx.$queryRaw<
      { id: string; matchScore: number; createdAt: Date }[]
    >`
      WITH ranked AS (
        SELECT lr."request_id", lr."created_at",
          (
            CASE WHEN lr."skill_id" = ANY(${skillIds}) THEN 1 ELSE 0 END
            + (COUNT(DISTINCT request_tag."tag_id") FILTER (
                WHERE request_tag."tag_id" = ANY(${candidateTagIds})
              ))::int
          ) AS match_score
        FROM "learning_requests" lr
        LEFT JOIN "learning_request_tags" request_tag
          ON request_tag."request_id" = lr."request_id"
        WHERE lr."status" = 'OPEN'
          AND lr."expires_at" > ${filter.now}
          AND lr."owner_id" <> ${filter.excludeOwnerId}::uuid
          AND (${skillSelection} OR ${tagSelection})
          ${skillFilter}
          ${tagFilter}
          ${keywordFilter}
        GROUP BY lr."request_id", lr."created_at", lr."skill_id"
      )
      SELECT request_id AS id, match_score AS "matchScore", created_at AS "createdAt"
      FROM ranked
      ${cursorFilter}
      ORDER BY match_score DESC, created_at DESC, request_id DESC
      LIMIT ${filter.take}
    `;
    if (ranked.length === 0) return [];
    const requests = await tx.learningRequest.findMany({
      where: { id: { in: ranked.map(({ id }) => id) } },
      include: includeContent,
    });
    const byId = new Map(
      requests.map((request) => [request.id, toRecord(request)]),
    );
    return ranked.flatMap((item) => {
      const request = byId.get(item.id);
      return request ? [{ request, matchScore: Number(item.matchScore) }] : [];
    });
  }
}
