import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "../../../../generated/prisma/client";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type {
  AdminTagQuery,
  TagRequestQuery,
} from "../../application/contracts/tag-contracts";
import { cursorScope, readCursor, page } from "../../domain/skill-policy";

@Injectable()
export class TagsRepository {
  constructor(private readonly db: PrismaService) {}

  async getTag(id: string, tx: TransactionContext = this.db, lock = false) {
    if (lock)
      await tx.$queryRaw`SELECT tag_id FROM tags WHERE tag_id=${id}::uuid FOR UPDATE`;
    const row = await tx.tag.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("TAG_NOT_FOUND");
    return row;
  }

  findByKey(tx: TransactionContext, labelKey: string) {
    return tx.tag.findUnique({ where: { labelKey } });
  }

  createTag(tx: TransactionContext, data: Prisma.TagUncheckedCreateInput) {
    return tx.tag.create({ data });
  }

  updateTag(
    tx: TransactionContext,
    id: string,
    data: Prisma.TagUncheckedUpdateInput,
  ) {
    return tx.tag.update({ where: { id }, data });
  }

  async createTagIfAbsent(
    tx: TransactionContext,
    data: { label: string; labelKey: string; createdByUserId: string },
  ) {
    const inserted = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO tags(tag_id,label,label_key,status,created_by_user_id,created_at,updated_at,version)
      VALUES(${randomUUID()}::uuid,${data.label},${data.labelKey},'ACTIVE',${data.createdByUserId}::uuid,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,1)
      ON CONFLICT (label_key) DO NOTHING RETURNING tag_id AS id
    `;
    const row = await this.findByKey(tx, data.labelKey);
    if (!row) throw new Error("Canonical tag was not visible after insertion");
    return {
      row: await this.getTag(row.id, tx, true),
      created: inserted.length === 1,
    };
  }

  async listTags(tx: TransactionContext, query: AdminTagQuery) {
    const scope = cursorScope({
      type: "admin-tags",
      q: query.q || null,
      status: query.status ?? null,
    });
    const cursor = readCursor(query.cursor, scope);
    const rows = await tx.tag.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.q
          ? {
              label: {
                contains: query.q.replace(/[\\%_]/gu, String.raw`\$&`),
                mode: "insensitive",
              },
            }
          : {}),
        ...(cursor
          ? {
              OR: [
                { label: { gt: cursor.value } },
                { label: cursor.value, id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ label: "asc" }, { id: "asc" }],
      take: query.limit + 1,
    });
    return page(rows, query.limit, scope, (row) => row.label);
  }

  async getRequest(
    id: string,
    tx: TransactionContext = this.db,
    lock = false,
    ownerId?: string,
  ) {
    if (lock)
      await tx.$queryRaw`SELECT tag_request_id FROM tag_creation_requests WHERE tag_request_id=${id}::uuid FOR UPDATE`;
    const row = await tx.tagCreationRequest.findFirst({
      where: { id, ...(ownerId ? { requestedByUserId: ownerId } : {}) },
    });
    if (!row) throw new NotFoundException("TAG_REQUEST_NOT_FOUND");
    return row;
  }

  createRequest(
    tx: TransactionContext,
    data: Prisma.TagCreationRequestUncheckedCreateInput,
  ) {
    return tx.tagCreationRequest.create({ data });
  }

  updateRequest(
    tx: TransactionContext,
    id: string,
    data: Prisma.TagCreationRequestUncheckedUpdateInput,
  ) {
    return tx.tagCreationRequest.update({ where: { id }, data });
  }

  async listRequests(
    tx: TransactionContext,
    query: TagRequestQuery,
    ownerId?: string,
  ) {
    const scope = cursorScope({
      type: "tag-requests",
      ownerId: ownerId ?? null,
      status: query.status ?? null,
    });
    const cursor = readCursor(query.cursor, scope);
    let createdAt: Date | undefined;
    if (cursor) {
      createdAt = new Date(cursor.value);
      if (
        !Number.isFinite(createdAt.getTime()) ||
        createdAt.toISOString() !== cursor.value
      )
        throw new BadRequestException("INVALID_CURSOR");
    }
    const rows = await tx.tagCreationRequest.findMany({
      where: {
        ...(ownerId ? { requestedByUserId: ownerId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(cursor && createdAt
          ? {
              OR: [
                { createdAt: { lt: createdAt } },
                { createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
    });
    return page(rows, query.limit, scope, (row) => row.createdAt.toISOString());
  }
}
