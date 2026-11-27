import {
  listInput,
  listBoundary,
  listResult,
} from "../../../../shared/http/list-page";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import type { Prisma } from "../../../../generated/prisma/client";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { FileAttachmentService } from "../../../../infrastructure/storage/file-attachment.service";
import { FileContentModeration } from "../../../../infrastructure/storage/file-content-moderation";
import { FileStorageService } from "../../../../infrastructure/storage/file-storage.service";
import { FileStorageError } from "../../../../infrastructure/storage/file.types";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { formatCredit } from "../../../credit/domain/money";
import {
  assertArchivable,
  listingText,
  priceUnits,
  statusAfterEdit,
  type MaterialAccess,
  type MaterialState,
} from "../../domain/material.policy";
import { ownerMaterialView } from "../contracts/material-view";
import {
  ContentModerationService,
  requireAllowed,
} from "../../../content-moderation/application/content-moderation.service";
import { SubscriptionEntitlementsReader } from "../../../subscriptions/application/services/subscription-entitlements.reader";
import { MaterialThumbnailsService } from "./material-thumbnails.service";
import { assertMaterialStorage } from "./material-storage";
import {
  materialFilterScope,
  materialListWhere,
  type MaterialListFilters,
} from "./material-list-filters";
import {
  assertReadyMaterialFile,
  lockMaterial,
  requirePermission,
  storageActor,
} from "./material-support";

export type CreateMaterialInput = {
  skillId: string;
  title: string;
  description: string;
  accessType: MaterialAccess;
  priceCredit: string;
  distributionRightsConfirmed: boolean;
  fileId?: string;
  coverFileId?: string;
};

export type UpdateMaterialInput = {
  expectedListingVersion: number;
  skillId?: string;
  title?: string;
  description?: string;
  accessType?: MaterialAccess;
  priceCredit?: string;
  fileId?: string | null;
  coverFileId?: string | null;
  distributionRightsConfirmed?: boolean;
};

@Injectable()
export class MaterialsService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly storage: FileStorageService,
    private readonly attachments: FileAttachmentService,
    private readonly thumbnails: MaterialThumbnailsService,
    private readonly moderation?: ContentModerationService,
    private readonly fileModeration?: FileContentModeration,
    private readonly plans?: SubscriptionEntitlementsReader,
  ) {}

  // Public methods that validate before the transaction are async so every
  // validation failure surfaces as a promise rejection, never a sync throw.
  async upload(
    principal: Principal,
    input: {
      name: string;
      claimedMime: string;
      body: Readable;
      correlationId: string;
    },
  ) {
    requirePermission(principal, "material:create:self");
    return this.storage.upload({
      actor: storageActor(principal),
      purpose: "MATERIAL",
      name: input.name,
      claimedMime: input.claimedMime,
      body: input.body,
      context: { correlationId: input.correlationId },
    });
  }

  async uploadCover(
    principal: Principal,
    input: {
      name: string;
      claimedMime: string;
      body: Readable;
      correlationId: string;
    },
  ) {
    requirePermission(principal, "material:create:self");
    return this.storage.upload({
      actor: storageActor(principal),
      purpose: "MATERIAL_COVER",
      name: input.name,
      claimedMime: input.claimedMime,
      body: input.body,
      context: { correlationId: input.correlationId },
    });
  }

  fileStatus(principal: Principal, fileId: string) {
    return this.attachments.status(principal, fileId);
  }

  async listMine(
    principal: Principal,
    query: MaterialListFilters & {
      limit?: number;
      cursor?: string;
      status?: MaterialState;
    } = {},
  ) {
    const ownerQuery = { ...query, ownerId: principal.userId };
    const filters = materialListWhere(ownerQuery);
    const parts = ["materials-mine-v1", principal.userId];
    if (query.status) parts.push(query.status);
    // The authenticated owner is already in the scope; caller-supplied ownerId
    // never changes management authorization or the cursor scope.
    const scope = JSON.stringify([
      ...parts,
      ...materialFilterScope({ ...query, ownerId: undefined }),
    ]);
    const { limit, cursor } = listInput(query, scope);
    const result = await this.transactions.run(async (tx) => {
      const rows = await tx.material.findMany({
        where: {
          ownerId: principal.userId,
          ...filters,
          ...ownerManageableWhere,
          status: query.status ?? { not: "ARCHIVED" },
          ...listBoundary("updatedAt", cursor),
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        include: ownerProjectionInclude,
      });
      return listResult(rows, limit, scope, (row) => row.updatedAt);
    });
    return {
      ...result,
      data: await Promise.all(
        result.data.map((row) => this.ownerProjectionFromRow(row)),
      ),
    };
  }

  async getMine(principal: Principal, id: string) {
    const row = await this.transactions.run((tx) =>
      tx.material.findUnique({
        where: { id, ownerId: principal.userId, ...ownerManageableWhere },
        include: ownerProjectionInclude,
      }),
    );
    if (!row) throw new NotFoundException("MATERIAL_NOT_FOUND");
    return this.ownerProjectionFromRow(row);
  }

  async create(principal: Principal, input: CreateMaterialInput) {
    requirePermission(principal, "material:create:self");
    if (input.distributionRightsConfirmed !== true)
      throw new BadRequestException("MATERIAL_RIGHTS_CONFIRMATION_REQUIRED");
    const text = listingText(input);
    const priceCredit = priceUnits(input.accessType, input.priceCredit);
    const created = await this.transactions.run(async (tx) => {
      await assertActiveSkill(tx, input.skillId);
      const id = randomUUID();
      const file = input.fileId
        ? await this.attachFile(tx, principal, input.fileId, id)
        : {};
      const cover = input.coverFileId
        ? await this.attachCover(tx, principal, input.coverFileId, id)
        : null;
      const created = await tx.material.create({
        data: {
          id,
          ownerId: principal.userId,
          skillId: input.skillId,
          ...text,
          accessType: input.accessType,
          priceCredit,
          listingVersion: 1,
          moderationStatus: "NONE",
          status: "DRAFT",
          distributionRightsConfirmedAt: new Date(),
          ...file,
          coverFileId: cover?.id ?? null,
          coverGeneration: cover ? 1 : 0,
        },
      });
      if (cover) await this.requestThumbnail(tx, created.id, cover.id, 1);
      return created;
    });
    return this.ownerProjection(created.id);
  }

  async update(principal: Principal, id: string, input: UpdateMaterialInput) {
    requirePermission(principal, "material:create:self");
    if (input.fileId === null)
      throw new BadRequestException("MATERIAL_FILE_REMOVAL_UNSUPPORTED");
    if (input.fileId && input.distributionRightsConfirmed !== true)
      throw new BadRequestException("MATERIAL_RIGHTS_CONFIRMATION_REQUIRED");
    const updated = await this.transactions.run(async (tx) => {
      const current = await lockOwned(tx, id, principal.userId);
      if (current.listingVersion !== input.expectedListingVersion)
        throw new ConflictException("MATERIAL_VERSION_CONFLICT");
      const status = statusAfterEdit(current.status, current.hasBeenPublished);
      const text = listingText({
        title: input.title ?? current.title,
        description: input.description ?? current.description,
      });
      const accessType = input.accessType ?? current.accessType;
      const priceCredit = priceUnits(
        accessType,
        input.priceCredit ?? formatCredit(current.priceCredit),
      );
      if (input.skillId) await assertActiveSkill(tx, input.skillId);
      const file = input.fileId
        ? {
            ...(await this.attachFile(tx, principal, input.fileId, id)),
            distributionRightsConfirmedAt: new Date(),
          }
        : {};
      const coverChanged =
        input.coverFileId !== undefined &&
        input.coverFileId !== current.coverFileId;
      const cover =
        coverChanged && input.coverFileId
          ? await this.attachCover(tx, principal, input.coverFileId, id)
          : null;
      const coverGeneration = coverChanged
        ? current.coverGeneration + 1
        : current.coverGeneration;
      if (coverChanged) {
        await tx.materialThumbnail.updateMany({
          where: {
            materialId: id,
            status: { in: ["PENDING", "READY", "FAILED"] },
          },
          data: { status: "SUPERSEDED" },
        });
      }
      await tx.material.update({
        where: { id },
        data: {
          ...text,
          skillId: input.skillId ?? current.skillId,
          accessType,
          priceCredit,
          ...file,
          ...(coverChanged
            ? {
                coverFileId: cover?.id ?? null,
                coverGeneration,
              }
            : {}),
          status,
          listingVersion: { increment: 1 },
          // A REJECTED listing edited back to DRAFT drops its old review state.
          ...(status === "DRAFT"
            ? { rejectReason: null, moderationStatus: "NONE" }
            : {}),
        },
      });
      if (cover) await this.requestThumbnail(tx, id, cover.id, coverGeneration);
      return tx.material.findUniqueOrThrow({
        where: { id },
        include: ownerProjectionInclude,
      });
    });
    return this.ownerProjectionFromRow(updated);
  }

  async submit(
    principal: Principal,
    id: string,
    expectedListingVersion: number,
  ) {
    requirePermission(principal, "material:create:self");
    assertListingVersion(expectedListingVersion);
    if (this.moderation) {
      const snapshot = await this.transactions.run((tx) =>
        this.submittableMaterial(
          tx,
          id,
          principal.userId,
          expectedListingVersion,
        ),
      );
      const assessment = await this.moderation.evaluateText(
        "material",
        String(expectedListingVersion),
        [snapshot.title, snapshot.description],
      );
      if (assessment.outcome !== "REVIEW") requireAllowed(assessment);
    }
    const updated = await this.transactions.run(async (tx) => {
      await this.submittableMaterial(
        tx,
        id,
        principal.userId,
        expectedListingVersion,
      );
      return tx.material.update({
        where: { id },
        data: {
          ...clearReviewDecision,
          status: "PENDING_REVIEW",
          moderationStatus: "PENDING",
          listingVersion: { increment: 1 },
        },
        include: ownerProjectionInclude,
      });
    });
    return this.ownerProjectionFromRow(updated);
  }

  private async submittableMaterial(
    tx: TransactionContext,
    id: string,
    userId: string,
    expectedVersion: number,
  ) {
    const current = await lockOwned(tx, id, userId);
    if (current.listingVersion !== expectedVersion)
      throw withdrawalConflict("MATERIAL_VERSION_CONFLICT", current);
    if (current.status !== "DRAFT" && current.status !== "ARCHIVED")
      throw new ConflictException("MATERIAL_TRANSITION_INVALID");
    await assertReadyMaterialFile(tx, current, this.fileModeration);
    return current;
  }

  async withdraw(
    principal: Principal,
    id: string,
    expectedListingVersion: number,
  ) {
    requirePermission(principal, "material:create:self");
    const updated = await this.transactions.run(async (tx) => {
      const current = await lockOwned(tx, id, principal.userId);
      if (current.listingVersion !== expectedListingVersion)
        throw withdrawalConflict("MATERIAL_VERSION_CONFLICT", current);
      if (current.status !== "PENDING_REVIEW")
        throw withdrawalConflict("MATERIAL_TRANSITION_INVALID", current);
      return tx.material.update({
        where: { id },
        data: {
          ...clearReviewDecision,
          status: "DRAFT",
          moderationStatus: "NONE",
          listingVersion: { increment: 1 },
        },
        include: ownerProjectionInclude,
      });
    });
    return this.ownerProjectionFromRow(updated);
  }

  async archive(
    principal: Principal,
    id: string,
    expectedListingVersion: number,
  ) {
    requirePermission(principal, "material:create:self");
    assertListingVersion(expectedListingVersion);
    const updated = await this.transactions.run(async (tx) => {
      const current = await lockOwned(tx, id, principal.userId);
      if (current.listingVersion !== expectedListingVersion)
        throw withdrawalConflict("MATERIAL_VERSION_CONFLICT", current);
      assertArchivable(current.status);
      return tx.material.update({
        where: { id },
        data: { status: "ARCHIVED", listingVersion: { increment: 1 } },
        include: ownerProjectionInclude,
      });
    });
    return this.ownerProjectionFromRow(updated);
  }

  /** Keep the material and its bound files so buyers retain their snapshots. */
  async remove(
    principal: Principal,
    id: string,
    expectedListingVersion: number,
  ) {
    requirePermission(principal, "material:create:self");
    if (!Number.isInteger(expectedListingVersion) || expectedListingVersion < 1)
      throw new BadRequestException("MATERIAL_VERSION_INVALID");
    return this.transactions.run(async (tx) => {
      const current = await lockOwned(tx, id, principal.userId, {
        includeDeleted: true,
      });
      if (current.deletedAt !== null)
        return { id, deleted: true, replayed: true };
      if (current.listingVersion !== expectedListingVersion)
        throw new ConflictException("MATERIAL_VERSION_CONFLICT");
      if (current.status !== "DRAFT" && current.status !== "ARCHIVED")
        throw new ConflictException("MATERIAL_DELETE_NOT_ALLOWED");
      await tx.materialThumbnail.updateMany({
        where: {
          materialId: id,
          status: { in: ["PENDING", "READY", "FAILED"] },
        },
        data: { status: "SUPERSEDED" },
      });
      await tx.material.update({
        where: { id },
        data: {
          status: "ARCHIVED",
          deletedAt: new Date(),
          listingVersion: { increment: 1 },
        },
      });
      return { id, deleted: true, replayed: false };
    });
  }

  private async ownerProjection(materialId: string) {
    const row = await this.transactions.run((tx) =>
      tx.material.findUniqueOrThrow({
        where: { id: materialId },
        include: ownerProjectionInclude,
      }),
    );
    return this.ownerProjectionFromRow(row);
  }

  private async ownerProjectionFromRow(row: OwnerProjectionRow) {
    const thumbnail = row.materialThumbnailMaterialIdRecords[0] ?? null;
    return {
      ...ownerMaterialView(row),
      cover: {
        attached: row.coverFileRecord !== null,
        generation: row.coverGeneration,
        file: row.coverFileRecord
          ? {
              id: row.coverFileRecord.id,
              originalFilename: row.coverFileRecord.originalName,
              mimeType: row.coverFileRecord.detectedMime,
              sizeBytes: row.coverFileRecord.sizeBytes?.toString() ?? null,
              state: row.coverFileRecord.state,
              scanVerdict: row.coverFileRecord.scanVerdict,
            }
          : null,
        processingStatus: row.coverFileRecord
          ? (thumbnail?.status ?? "PENDING")
          : "NONE",
        failureCode: thumbnail?.failureCode ?? null,
        preview: await this.thumbnails.publicProjection(
          row.mimeType,
          thumbnail,
        ),
      },
    };
  }

  /** Binds a READY/CLEAN upload once; the previous object stays bound for buyers (D5). */
  private async attachFile(
    tx: TransactionContext,
    principal: Principal,
    fileId: string,
    materialId: string,
  ) {
    const file = await this.attachments.attachReady(tx, principal, fileId, {
      type: "MATERIAL",
      id: materialId,
      purpose: "MATERIAL",
    });
    await this.assertStorage(
      tx,
      principal.userId,
      materialId,
      BigInt(file.size),
    );
    return {
      storageKey: file.key,
      originalFilename: file.originalName,
      mimeType: file.mime,
      sizeBytes: BigInt(file.size),
      checksum: file.checksum,
      scanStatus: "CLEAN",
      uploadedAt: file.uploadedAt,
    };
  }

  /**
   * Spec 021 D9: runs after the upload is bound, in the same transaction, so a refusal rolls
   * the binding back and the upload stays attachable once space is freed.
   */
  private async assertStorage(
    tx: TransactionContext,
    ownerId: string,
    materialId: string,
    sizeBytes: bigint,
  ) {
    if (!this.plans) return;
    const allowedBytes = await this.plans.materialStorageAllowance(
      tx,
      ownerId,
      new Date(),
    );
    if (allowedBytes === null) return;
    await assertMaterialStorage(tx, {
      ownerId,
      materialId,
      sizeBytes,
      allowedBytes,
    });
  }

  private async attachCover(
    tx: TransactionContext,
    principal: Principal,
    fileId: string,
    materialId: string,
  ) {
    try {
      return await this.attachments.attachReady(tx, principal, fileId, {
        type: "MATERIAL_COVER",
        id: materialId,
        purpose: "MATERIAL_COVER",
      });
    } catch (error) {
      if (error instanceof FileStorageError && error.code === "FILE_NOT_READY")
        throw new ConflictException("MATERIAL_COVER_NOT_READY");
      throw error;
    }
  }

  private async requestThumbnail(
    tx: TransactionContext,
    materialId: string,
    sourceFileId: string,
    generation: number,
  ) {
    const thumbnail = await tx.materialThumbnail.create({
      data: {
        id: randomUUID(),
        materialId,
        sourceFileId,
        sourceGeneration: generation,
        status: "PENDING",
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "MATERIAL_THUMBNAIL",
        aggregateId: thumbnail.id,
        version: 1,
        type: "material.thumbnail.requested",
        payload: { thumbnailId: thumbnail.id, materialId, generation },
        dedupeKey: `material-thumbnail:${thumbnail.id}:${generation}`,
        correlationId: randomUUID(),
      },
    });
  }
}

const ownerManageableWhere = {
  deletedAt: null,
  legacyArchiveUnclassified: false,
} satisfies Prisma.MaterialWhereInput;

const clearReviewDecision = {
  rejectReason: null,
  reviewedAt: null,
  reviewedByUserId: null,
};

function assertListingVersion(version: number) {
  if (!Number.isInteger(version) || version < 1)
    throw new BadRequestException("MATERIAL_VERSION_INVALID");
}

function withdrawalConflict(
  message: "MATERIAL_VERSION_CONFLICT" | "MATERIAL_TRANSITION_INVALID",
  material: { status: MaterialState; listingVersion: number },
) {
  return new ConflictException({
    message,
    details: {
      currentStatus: material.status,
      currentListingVersion: material.listingVersion,
    },
  });
}

const ownerProjectionInclude = {
  coverFileRecord: {
    select: {
      id: true,
      originalName: true,
      detectedMime: true,
      sizeBytes: true,
      state: true,
      scanVerdict: true,
    },
  },
  materialThumbnailMaterialIdRecords: {
    orderBy: { sourceGeneration: "desc" as const },
    take: 1,
  },
};

type OwnerProjectionRow = Prisma.MaterialGetPayload<{
  include: typeof ownerProjectionInclude;
}>;

/** Use the same 404 for rows outside the caller's management scope. */
async function lockOwned(
  tx: TransactionContext,
  id: string,
  ownerId: string,
  { includeDeleted = false } = {},
) {
  const material = await lockMaterial(tx, id);
  if (
    material.ownerId !== ownerId ||
    material.legacyArchiveUnclassified ||
    (!includeDeleted && material.deletedAt !== null)
  )
    throw new NotFoundException("MATERIAL_NOT_FOUND");
  return material;
}

async function assertActiveSkill(tx: TransactionContext, skillId: string) {
  const skill = await tx.skill.findUnique({
    where: { id: skillId },
    select: { status: true },
  });
  if (skill?.status !== "ACTIVE")
    throw new BadRequestException("MATERIAL_SKILL_INVALID");
}
