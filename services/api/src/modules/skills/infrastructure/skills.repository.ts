import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import { Prisma, type CatalogStatus } from "../../../generated/prisma/client";
import type { SkillQuery, TagQuery } from "../application/skill-contracts";
import { cursorScope, page, readCursor, nameKey } from "../domain/skill-policy";

@Injectable()
export class SkillsRepository {
  constructor(private readonly db: PrismaService) {}
  lockSelection(tx: TransactionContext, ids: readonly string[]) {
    return tx.$queryRaw<{ id: string; status: CatalogStatus }[]>(Prisma.sql`
      SELECT skill_id AS id, status FROM skills
      WHERE skill_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY skill_id
      FOR UPDATE
    `);
  }
  async get(id: string, tx: TransactionContext = this.db, lock = false) {
    if (lock)
      await tx.$queryRaw`SELECT skill_id FROM skills WHERE skill_id=${id}::uuid FOR UPDATE`;
    const row = await tx.skill.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    return row;
  }
  create(tx: TransactionContext, data: Prisma.SkillUncheckedCreateInput) {
    return tx.skill.create({ data });
  }
  update(
    tx: TransactionContext,
    id: string,
    data: Prisma.SkillUncheckedUpdateInput,
  ) {
    return tx.skill.update({ where: { id }, data });
  }
  async category(tx: TransactionContext, id: string) {
    if (!(await tx.skillCategory.findUnique({ where: { id } })))
      throw new NotFoundException("SKILL_CATEGORY_NOT_FOUND");
  }
  async listTags(query: TagQuery) {
    const scope = cursorScope({ type: "tags", q: query.q || null });
    const cursor = readCursor(query.cursor, scope);
    const where: Prisma.TagWhereInput = {
      status: "ACTIVE",
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
    };
    return page(
      await this.db.tag.findMany({
        where,
        select: { id: true, label: true },
        orderBy: [{ label: "asc" }, { id: "asc" }],
        take: query.limit + 1,
      }),
      query.limit,
      scope,
      (row) => row.label,
    );
  }
  async list(query: SkillQuery, admin = false) {
    const scope = cursorScope({
      type: "catalog",
      q: query.q ?? null,
      category: query.categoryId ?? null,
      status: admin ? (query.status ?? null) : "ACTIVE",
    });
    const cursor = readCursor(query.cursor, scope);
    const status = admin ? query.status : "ACTIVE";
    const where: Prisma.SkillWhereInput = {
      ...(status ? { status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.q
        ? {
            nameKey: {
              contains: nameKey(query.q).replace(/[\\%_]/gu, String.raw`\$&`),
            },
          }
        : {}),
      ...(cursor
        ? {
            OR: [
              { nameKey: { gt: cursor.value } },
              { nameKey: cursor.value, id: { gt: cursor.id } },
            ],
          }
        : {}),
    };
    return page(
      await this.db.skill.findMany({
        where,
        orderBy: [{ nameKey: "asc" }, { id: "asc" }],
        take: query.limit + 1,
      }),
      query.limit,
      scope,
      (row) => row.nameKey,
    );
  }
}
