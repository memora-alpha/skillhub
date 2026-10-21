import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Material, Prisma } from "../../../../generated/prisma/client";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { FileAttachmentService } from "../../../../infrastructure/storage/file-attachment.service";
import { FileStorageService } from "../../../../infrastructure/storage/file-storage.service";
import type { Principal } from "../../../auth/application/services/sessions.service";
import {
  snapshotStorageKey,
  type MaterialAccess,
} from "../../domain/material.policy";
import { publicMaterialView } from "../contracts/material-view";
import {
  isModerator,
  requirePermission,
  storageActor,
} from "./material-support";

const LISTED = { status: "PUBLISHED", scanStatus: "CLEAN" } as const;

@Injectable()
export class MaterialCatalogService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly storage: FileStorageService,
    private readonly attachments: FileAttachmentService,
  ) {}

  search(query: {
    q?: string;
    skillId?: string;
    accessType?: MaterialAccess;
    page: number;
    limit: number;
  }) {
    const q = query.q?.trim();
    const where: Prisma.MaterialWhereInput = {
      ...LISTED,
      ...(query.skillId ? { skillId: query.skillId } : {}),
      ...(query.accessType ? { accessType: query.accessType } : {}),
      // ponytail: ILIKE scan; add a pg_trgm index when the catalog outgrows it.
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return this.transactions.run(
      async (tx) => {
        const rows = await tx.material.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });
        const total = await tx.material.count({ where });
        return {
          data: rows.map(publicMaterialView),
          pagination: { page: query.page, limit: query.limit, total },
        };
      },
      { isolationLevel: "ReadCommitted" },
    );
  }

  async detail(id: string) {
    const material = await this.transactions.run(
      (tx) => tx.material.findFirst({ where: { id, ...LISTED } }),
      { isolationLevel: "ReadCommitted" },
    );
    if (!material) throw new NotFoundException("MATERIAL_NOT_FOUND");
    return publicMaterialView(material);
  }

  /** FR-MAT-04: authorize every download, then sign a short-lived URL. */
  async download(principal: Principal, id: string) {
    const fileId = await this.transactions.run(async (tx) => {
      const material = await tx.material.findUnique({ where: { id } });
      if (!material) throw new NotFoundException("MATERIAL_NOT_FOUND");
      const objectKey = await this.downloadKey(tx, principal, material);
      const stored = await tx.storedFile.findFirst({
        where: {
          objectKey,
          resourceType: "MATERIAL",
          resourceId: id,
          purpose: "MATERIAL",
        },
        select: { id: true },
      });
      if (!stored) throw new NotFoundException("MATERIAL_FILE_NOT_FOUND");
      await this.attachments.assertBoundReady(tx, stored.id, {
        type: "MATERIAL",
        id,
      });
      return stored.id;
    });
    return this.storage.issueDownload(
      {
        actor: storageActor(principal),
        fileId,
        resource: { type: "MATERIAL", id },
      },
      // Authorization already ran inside the transaction above.
      { assertRead: () => Promise.resolve() },
    );
  }

  /**
   * Owner/moderator: current file. An ACTIVE purchase entitlement outranks the current
   * accessType and serves the purchased snapshot unless HIDDEN (D4, D5, D9). Everyone
   * else: FREE needs PUBLISHED and gets the current file; PAID is denied.
   */
  private async downloadKey(
    tx: TransactionContext,
    principal: Principal,
    material: Material,
  ): Promise<string> {
    if (material.ownerId === principal.userId || isModerator(principal)) {
      if (!material.storageKey)
        throw new ConflictException("MATERIAL_FILE_REQUIRED");
      return material.storageKey;
    }
    requirePermission(principal, "material:access");
    const entitlement = await tx.materialEntitlement.findUnique({
      where: {
        userId_materialId: {
          userId: principal.userId,
          materialId: material.id,
        },
      },
      include: { sourceOrderIdRecord: true },
    });
    const order =
      entitlement?.status === "ACTIVE" ? entitlement.sourceOrderIdRecord : null;
    if (order) {
      if (material.status === "HIDDEN")
        throw new ConflictException("MATERIAL_NOT_PUBLISHED");
      return snapshotStorageKey(order.purchasedFileSnapshot);
    }
    if (material.accessType === "PAID")
      throw new ForbiddenException("MATERIAL_ACCESS_DENIED");
    if (material.status !== "PUBLISHED" || !material.storageKey)
      throw new ConflictException("MATERIAL_NOT_PUBLISHED");
    return material.storageKey;
  }
}
