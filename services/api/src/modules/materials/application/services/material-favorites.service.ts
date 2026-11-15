import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import {
  listBoundary,
  listInput,
  listResult,
} from "../../../../shared/http/list-page";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { publicMaterialView } from "../contracts/material-view";
import { requirePermission } from "./material-support";

@Injectable()
export class MaterialFavoritesService {
  constructor(private readonly transactions: TransactionRunner) {}

  async add(principal: Principal, materialId: string) {
    requirePermission(principal, "material:access");
    return this.transactions.run(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`material-favorite:${principal.userId}:${materialId}`}, 0))`;
      const material = await tx.material.findFirst({
        where: { id: materialId, status: "PUBLISHED", scanStatus: "CLEAN" },
        select: { id: true },
      });
      if (!material) throw new NotFoundException("MATERIAL_NOT_FOUND");
      const existing = await tx.materialFavorite.findUnique({
        where: {
          userId_materialId: { userId: principal.userId, materialId },
        },
      });
      if (existing)
        return { favorite: favoriteIdentity(existing), replayed: true };
      const favorite = await tx.materialFavorite.create({
        data: { id: randomUUID(), userId: principal.userId, materialId },
      });
      return { favorite: favoriteIdentity(favorite), replayed: false };
    });
  }

  async remove(principal: Principal, materialId: string) {
    requirePermission(principal, "material:access");
    return this.transactions.run(async (tx) => {
      const result = await tx.materialFavorite.deleteMany({
        where: { userId: principal.userId, materialId },
      });
      return { materialId, removed: result.count > 0 };
    });
  }

  async list(
    principal: Principal,
    query: { limit?: number; cursor?: string } = {},
  ) {
    requirePermission(principal, "material:access");
    const scope = JSON.stringify(["material-favorites-v1", principal.userId]);
    const { limit, cursor } = listInput(query, scope);
    return this.transactions.run(async (tx) => {
      const rows = await tx.materialFavorite.findMany({
        where: {
          userId: principal.userId,
          materialIdRecord: { status: "PUBLISHED", scanStatus: "CLEAN" },
          ...listBoundary("createdAt", cursor),
        },
        include: { materialIdRecord: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });
      const page = listResult(rows, limit, scope, (row) => row.createdAt);
      return {
        data: page.data.map((row) => ({
          id: row.id,
          savedAt: row.createdAt,
          material: publicMaterialView(row.materialIdRecord),
        })),
        pagination: page.pagination,
      };
    });
  }
}

function favoriteIdentity(favorite: {
  id: string;
  materialId: string;
  createdAt: Date;
}) {
  return {
    id: favorite.id,
    materialId: favorite.materialId,
    savedAt: favorite.createdAt,
  };
}
