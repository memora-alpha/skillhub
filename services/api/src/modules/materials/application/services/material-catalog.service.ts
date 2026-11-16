import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma, type Material } from "../../../../generated/prisma/client";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { FileAttachmentService } from "../../../../infrastructure/storage/file-attachment.service";
import { FileStorageService } from "../../../../infrastructure/storage/file-storage.service";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { listInput, listResult } from "../../../../shared/http/list-page";
import {
  snapshotStorageKey,
  type MaterialAccess,
} from "../../domain/material.policy";
import { publicMaterialView } from "../contracts/material-view";
import { materialRatingSummaryView } from "./material-rating-summary.service";
import { MaterialThumbnailsService } from "./material-thumbnails.service";
import {
  isModerator,
  requirePermission,
  storageActor,
} from "./material-support";

const LISTED = { status: "PUBLISHED", scanStatus: "CLEAN" } as const;
const MAX_DOWNLOAD_TTL_MS = 300_000;
const DOWNLOAD_SIGNING_LEASE_MS = 30_000;

@Injectable()
export class MaterialCatalogService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly storage: FileStorageService,
    private readonly attachments: FileAttachmentService,
    private readonly thumbnails: MaterialThumbnailsService,
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
          include: {
            materialRatingSummary: true,
            materialThumbnailMaterialIdRecords: {
              where: { status: "READY" },
              orderBy: { sourceGeneration: "desc" },
              take: 1,
            },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });
        const total = await tx.material.count({ where });
        return {
          data: await Promise.all(
            rows.map(async (row) => ({
              ...publicMaterialView(row),
              ratingSummary: materialRatingSummaryView(
                row.materialRatingSummary,
              ),
              thumbnail: await this.thumbnails.publicProjection(
                row.mimeType,
                row.materialThumbnailMaterialIdRecords[0],
              ),
            })),
          ),
          pagination: { page: query.page, limit: query.limit, total },
        };
      },
      { isolationLevel: "ReadCommitted" },
    );
  }

  async detail(id: string) {
    const material = await this.transactions.run(
      (tx) =>
        tx.material.findFirst({
          where: { id, ...LISTED },
          include: {
            materialRatingSummary: true,
            materialThumbnailMaterialIdRecords: {
              where: { status: "READY" },
              orderBy: { sourceGeneration: "desc" },
              take: 1,
            },
          },
        }),
      { isolationLevel: "ReadCommitted" },
    );
    if (!material) throw new NotFoundException("MATERIAL_NOT_FOUND");
    return {
      ...publicMaterialView(material),
      ratingSummary: materialRatingSummaryView(material.materialRatingSummary),
      thumbnail: await this.thumbnails.publicProjection(
        material.mimeType,
        material.materialThumbnailMaterialIdRecords[0],
      ),
    };
  }

  /** Successful FREE grants are durable access history and back the mobile library. */
  async listFreeAccesses(
    principal: Principal,
    query: { limit?: number; cursor?: string } = {},
  ) {
    requirePermission(principal, "material:access");
    const scope = JSON.stringify([
      "material-library-free-v1",
      principal.userId,
    ]);
    const { limit, cursor } = listInput(query, scope);
    const boundary = cursor
      ? Prisma.sql`HAVING (MAX(access_grant.issued_at), access_grant.material_id) < (${new Date(
          cursor.value,
        )}, ${cursor.id}::uuid)`
      : Prisma.empty;
    const result = await this.transactions.run(
      async (tx) => {
        const accessRows = await tx.$queryRaw<FreeAccessRow[]>`
          SELECT access_grant.material_id AS id,
                 MIN(access_grant.issued_at) AS "firstAccessedAt",
                 MAX(access_grant.issued_at) AS "lastAccessedAt"
          FROM material_download_grants AS access_grant
          INNER JOIN materials AS material
            ON material.material_id = access_grant.material_id
          WHERE access_grant.requested_by = ${principal.userId}::uuid
            AND access_grant.access_source = 'FREE_PUBLIC'
            AND access_grant.status = 'ISSUED'
            AND access_grant.issued_at IS NOT NULL
            AND material.access_type = 'FREE'
            AND material.status = 'PUBLISHED'
            AND material.scan_status = 'CLEAN'
          GROUP BY access_grant.material_id
          ${boundary}
          ORDER BY MAX(access_grant.issued_at) DESC, access_grant.material_id DESC
          LIMIT ${limit + 1}`;
        const page = listResult(
          accessRows,
          limit,
          scope,
          (row) => row.lastAccessedAt,
        );
        const materials = await tx.material.findMany({
          where: { id: { in: page.data.map((row) => row.id) } },
          include: {
            materialThumbnailMaterialIdRecords: {
              where: { status: "READY" },
              orderBy: { sourceGeneration: "desc" },
              take: 1,
            },
          },
        });
        return { page, materials };
      },
      { isolationLevel: "ReadCommitted" },
    );
    const materialById = new Map(
      result.materials.map((material) => [material.id, material]),
    );
    return {
      data: await Promise.all(
        result.page.data.map(async (access) => {
          const material = materialById.get(access.id);
          if (!material) throw new NotFoundException("MATERIAL_NOT_FOUND");
          return {
            accessSource: "FREE_PUBLIC" as const,
            firstAccessedAt: access.firstAccessedAt,
            lastAccessedAt: access.lastAccessedAt,
            material: {
              ...publicMaterialView(material),
              thumbnail: await this.thumbnails.publicProjection(
                material.mimeType,
                material.materialThumbnailMaterialIdRecords[0],
              ),
            },
          };
        }),
      ),
      pagination: result.page.pagination,
    };
  }

  /** FR-MAT-04: authorize every download, then sign a short-lived URL. */
  async download(principal: Principal, id: string) {
    const access = await this.transactions.run(async (tx) => {
      const material = await tx.material.findUnique({ where: { id } });
      if (!material) throw new NotFoundException("MATERIAL_NOT_FOUND");
      const { objectKey, orderId, accessSource } = await this.downloadKey(
        tx,
        principal,
        material,
      );
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
      if (orderId) {
        await tx.$queryRaw`SELECT order_id FROM material_orders
          WHERE order_id = ${orderId}::uuid FOR UPDATE`;
        const entitlement = await tx.materialEntitlement.findUnique({
          where: {
            userId_materialId: { userId: principal.userId, materialId: id },
          },
          select: { sourceOrderId: true, status: true },
        });
        const order = await tx.materialOrder.findUnique({
          where: { id: orderId },
          select: { status: true },
        });
        if (
          order?.status !== "SUCCESS" ||
          entitlement?.status !== "ACTIVE" ||
          entitlement.sourceOrderId !== orderId
        )
          throw new ConflictException("MATERIAL_ACCESS_CHANGED");
      }
      if (!accessSource)
        return { fileId: stored.id, orderId: null, grantId: null };
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      if (!(clock?.now instanceof Date))
        throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
      const grant = await tx.materialDownloadGrant.create({
        data: {
          id: randomUUID(),
          materialId: id,
          orderId,
          requestedBy: principal.userId,
          accessSource,
          status: "PENDING",
          // Configured URL TTL is capped at 300s. The bounded signing lease keeps
          // crash recovery from reopening refunds while a URL could still be usable.
          expiresAt: new Date(
            clock.now.getTime() +
              MAX_DOWNLOAD_TTL_MS +
              DOWNLOAD_SIGNING_LEASE_MS,
          ),
        },
      });
      return { fileId: stored.id, orderId, grantId: grant.id };
    });
    try {
      const link = await this.storage.issueDownload(
        {
          actor: storageActor(principal),
          fileId: access.fileId,
          resource: { type: "MATERIAL", id },
        },
        // Authorization already ran inside the transaction above.
        { assertRead: () => Promise.resolve() },
      );
      if (access.grantId) {
        await this.transactions.run(async (tx) => {
          if (access.orderId)
            await tx.$queryRaw`SELECT order_id FROM material_orders
              WHERE order_id = ${access.orderId}::uuid FOR UPDATE`;
          const [clock] = await tx.$queryRaw<
            { now: Date }[]
          >`SELECT CURRENT_TIMESTAMP AS now`;
          if (!(clock?.now instanceof Date))
            throw new ConflictException("DATABASE_TIME_UNAVAILABLE");
          const order = access.orderId
            ? await tx.materialOrder.findUnique({
                where: { id: access.orderId },
                select: { status: true, consumedAt: true },
              })
            : null;
          if (access.orderId && order?.status !== "SUCCESS")
            throw new ConflictException("MATERIAL_ACCESS_CHANGED");
          const issued = await tx.materialDownloadGrant.updateMany({
            where: {
              id: access.grantId,
              materialId: id,
              status: "PENDING",
              expiresAt: { gt: clock.now },
            },
            data: {
              status: "ISSUED",
              issuedAt: clock.now,
              expiresAt: link.expiresAt,
            },
          });
          if (issued.count !== 1)
            throw new ConflictException("MATERIAL_ACCESS_CHANGED");
          if (access.orderId && order && !order.consumedAt) {
            await tx.materialOrder.update({
              where: { id: access.orderId },
              data: { consumedAt: clock.now },
            });
          }
        });
      }
      return link;
    } catch (error) {
      if (access.grantId) {
        await this.transactions
          .run(async (tx) => {
            const [clock] = await tx.$queryRaw<
              { now: Date }[]
            >`SELECT CURRENT_TIMESTAMP AS now`;
            if (!(clock?.now instanceof Date)) return;
            await tx.materialDownloadGrant.updateMany({
              where: { id: access.grantId!, status: "PENDING" },
              data: {
                status: "FAILED",
                failedAt: clock.now,
                failureCode: downloadFailureCode(error),
              },
            });
          })
          .catch(() => undefined);
      }
      throw error;
    }
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
  ): Promise<{
    objectKey: string;
    orderId: string | null;
    accessSource: "FREE_PUBLIC" | "PAID_ENTITLEMENT" | null;
  }> {
    if (material.ownerId === principal.userId || isModerator(principal)) {
      if (!material.storageKey)
        throw new ConflictException("MATERIAL_FILE_REQUIRED");
      return {
        objectKey: material.storageKey,
        orderId: null,
        accessSource: null,
      };
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
      return {
        objectKey: snapshotStorageKey(order.purchasedFileSnapshot),
        orderId: order.id,
        accessSource: "PAID_ENTITLEMENT",
      };
    }
    if (material.accessType === "PAID")
      throw new ForbiddenException("MATERIAL_ACCESS_DENIED");
    if (material.status !== "PUBLISHED" || !material.storageKey)
      throw new ConflictException("MATERIAL_NOT_PUBLISHED");
    return {
      objectKey: material.storageKey,
      orderId: null,
      accessSource: "FREE_PUBLIC",
    };
  }
}

type FreeAccessRow = {
  id: string;
  firstAccessedAt: Date;
  lastAccessedAt: Date;
};

function downloadFailureCode(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  )
    return error.code.slice(0, 100);
  return "DOWNLOAD_SIGNING_FAILED";
}
