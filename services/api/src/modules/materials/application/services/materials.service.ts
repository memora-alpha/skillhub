import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { FileAttachmentService } from "../../../../infrastructure/storage/file-attachment.service";
import { FileStorageService } from "../../../../infrastructure/storage/file-storage.service";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { formatCredit } from "../../../credit/domain/money";
import {
  assertArchivable,
  assertPublishableFile,
  listingText,
  priceUnits,
  statusAfterEdit,
  type MaterialAccess,
} from "../../domain/material.policy";
import { ownerMaterialView } from "../contracts/material-view";
import {
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
};

export type UpdateMaterialInput = {
  expectedListingVersion: number;
  skillId?: string;
  title?: string;
  description?: string;
  accessType?: MaterialAccess;
  priceCredit?: string;
  fileId?: string;
  distributionRightsConfirmed?: boolean;
};

@Injectable()
export class MaterialsService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly storage: FileStorageService,
    private readonly attachments: FileAttachmentService,
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

  fileStatus(principal: Principal, fileId: string) {
    return this.attachments.status(principal, fileId);
  }

  listMine(principal: Principal) {
    return this.transactions.run(async (tx) => {
      // ponytail: newest 100 only; add cursor pagination when an owner exceeds it.
      const rows = await tx.material.findMany({
        where: { ownerId: principal.userId },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 100,
      });
      return rows.map(ownerMaterialView);
    });
  }

  async create(principal: Principal, input: CreateMaterialInput) {
    requirePermission(principal, "material:create:self");
    if (input.distributionRightsConfirmed !== true)
      throw new BadRequestException("MATERIAL_RIGHTS_CONFIRMATION_REQUIRED");
    const text = listingText(input);
    const priceCredit = priceUnits(input.accessType, input.priceCredit);
    return this.transactions.run(async (tx) => {
      await assertActiveSkill(tx, input.skillId);
      const id = randomUUID();
      const file = input.fileId
        ? await this.attachFile(tx, principal, input.fileId, id)
        : {};
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
        },
      });
      return ownerMaterialView(created);
    });
  }

  async update(principal: Principal, id: string, input: UpdateMaterialInput) {
    requirePermission(principal, "material:create:self");
    if (input.fileId && input.distributionRightsConfirmed !== true)
      throw new BadRequestException("MATERIAL_RIGHTS_CONFIRMATION_REQUIRED");
    return this.transactions.run(async (tx) => {
      const current = await lockOwned(tx, id, principal.userId);
      if (current.listingVersion !== input.expectedListingVersion)
        throw new ConflictException("MATERIAL_VERSION_CONFLICT");
      const status = statusAfterEdit(current.status);
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
      const updated = await tx.material.update({
        where: { id },
        data: {
          ...text,
          skillId: input.skillId ?? current.skillId,
          accessType,
          priceCredit,
          ...file,
          status,
          listingVersion: { increment: 1 },
          ...(current.status === "PUBLISHED"
            ? { moderationStatus: "PENDING" }
            : {}),
          // A REJECTED listing edited back to DRAFT drops its old review state.
          ...(status === "DRAFT"
            ? { rejectReason: null, moderationStatus: "NONE" }
            : {}),
        },
      });
      return ownerMaterialView(updated);
    });
  }

  async submit(principal: Principal, id: string) {
    requirePermission(principal, "material:create:self");
    return this.transactions.run(async (tx) => {
      const current = await lockOwned(tx, id, principal.userId);
      if (current.status !== "DRAFT")
        throw new ConflictException("MATERIAL_TRANSITION_INVALID");
      assertPublishableFile(current);
      const updated = await tx.material.update({
        where: { id },
        data: { status: "PENDING_REVIEW", moderationStatus: "PENDING" },
      });
      return ownerMaterialView(updated);
    });
  }

  async archive(principal: Principal, id: string) {
    requirePermission(principal, "material:create:self");
    return this.transactions.run(async (tx) => {
      const current = await lockOwned(tx, id, principal.userId);
      assertArchivable(current.status);
      const updated = await tx.material.update({
        where: { id },
        data: { status: "ARCHIVED" },
      });
      return ownerMaterialView(updated);
    });
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
}

/** Other owners' materials get the same 404 as missing ones (no existence oracle). */
async function lockOwned(tx: TransactionContext, id: string, ownerId: string) {
  const material = await lockMaterial(tx, id);
  if (material.ownerId !== ownerId)
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
