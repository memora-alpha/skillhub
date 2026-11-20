import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import {
  listBoundary,
  listInput,
  listResult,
} from "../../../../shared/http/list-page";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { CatalogSyncService } from "./catalog-sync.service";
import {
  adminProductView,
  auditContext,
  humanActor,
  productView,
  requireReward,
  type Locale,
} from "./reward-support";

export type ProductUpdate = {
  priceCredit?: bigint | null;
  status?: "ACTIVE" | "INACTIVE";
  sortOrder?: number;
  displayNameOverride?: string | null;
  imageOverride?: string | null;
  reason: string;
};

@Injectable()
export class RewardCatalogService {
  constructor(
    private readonly db: PrismaService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly sync: CatalogSyncService,
  ) {}

  /** Only ACTIVE, priced products of ACTIVE brands are visible; the catalog is small, so unpaginated. */
  async listActive(
    query: { brandId?: string; category?: string },
    locale: Locale,
  ) {
    const rows = await this.db.rewardProduct.findMany({
      where: {
        status: "ACTIVE",
        priceCredit: { not: null },
        brand: { status: "ACTIVE" },
        ...(query.brandId ? { brandId: query.brandId } : {}),
        ...(query.category ? { category: query.category } : {}),
      },
      include: { brand: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      take: 200,
    });
    return rows.map((row) => productView(row, locale));
  }

  async get(id: string, locale: Locale) {
    const product = await this.db.rewardProduct.findFirst({
      where: {
        id,
        status: "ACTIVE",
        priceCredit: { not: null },
        brand: { status: "ACTIVE" },
      },
      include: { brand: true },
    });
    if (!product) throw new NotFoundException("REWARD_NOT_AVAILABLE");
    return productView(product, locale);
  }

  async adminList(
    principal: Principal,
    query: { limit?: number; cursor?: string; status?: string },
  ) {
    requireReward(principal, "reward:manage");
    const scope = "admin-rewards:products";
    const { limit, cursor } = listInput(query, scope);
    const status = ["ACTIVE", "INACTIVE", "REMOVED"].includes(
      query.status ?? "",
    )
      ? (query.status as "ACTIVE" | "INACTIVE" | "REMOVED")
      : undefined;
    const rows = await this.db.rewardProduct.findMany({
      where: {
        ...(status ? { status } : {}),
        ...listBoundary("updatedAt", cursor),
      },
      include: { brand: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = listResult(rows, limit, scope, (row) => row.updatedAt);
    return {
      data: page.data.map(adminProductView),
      pagination: page.pagination,
    };
  }

  async adminUpdate(principal: Principal, id: string, input: ProductUpdate) {
    requireReward(principal, "reward:manage");
    if (!input.reason.trim()) throw new BadRequestException("REASON_REQUIRED");
    return this.transactions.run(async (tx) => {
      await tx.$queryRaw`SELECT id FROM reward_products WHERE id = ${id}::uuid FOR UPDATE`;
      const product = await tx.rewardProduct.findUnique({ where: { id } });
      if (!product) throw new NotFoundException("REWARD_PRODUCT_NOT_FOUND");
      if (product.status === "REMOVED" && input.status === "ACTIVE")
        throw new ConflictException("REWARD_PRODUCT_REMOVED");
      const price =
        input.priceCredit === undefined
          ? product.priceCredit
          : input.priceCredit;
      if (price !== null && price <= 0n)
        throw new BadRequestException("INVALID_REWARD_PRICE");
      const status = input.status ?? product.status;
      if (status === "ACTIVE" && price === null)
        throw new ConflictException("REWARD_PRICE_REQUIRED");
      const priceChanged = price !== product.priceCredit;
      const updated = await tx.rewardProduct.update({
        where: { id },
        data: {
          priceCredit: price,
          status,
          ...(priceChanged ? { priceVersion: { increment: 1 } } : {}),
          ...(input.sortOrder === undefined
            ? {}
            : { sortOrder: input.sortOrder }),
          ...(input.displayNameOverride === undefined
            ? {}
            : { displayNameOverride: input.displayNameOverride }),
          ...(input.imageOverride === undefined
            ? {}
            : { imageOverride: input.imageOverride }),
        },
        include: { brand: true },
      });
      await this.audit.append(tx, {
        actor: humanActor(principal),
        action: "REWARD_PRODUCT_UPDATE",
        target: { type: "REWARD_PRODUCT", id },
        before: {
          priceCredit: product.priceCredit?.toString() ?? null,
          priceVersion: product.priceVersion,
          status: product.status,
        },
        after: {
          priceCredit: updated.priceCredit?.toString() ?? null,
          priceVersion: updated.priceVersion,
          status: updated.status,
        },
        reason: input.reason.trim(),
        context: auditContext(),
      });
      return adminProductView(updated);
    });
  }

  async adminSync(principal: Principal) {
    requireReward(principal, "reward:manage");
    return this.sync.sync();
  }
}
