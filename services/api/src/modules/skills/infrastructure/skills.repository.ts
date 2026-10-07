import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import type { Prisma } from "../../../generated/prisma/client";
import type { SkillQuery } from "../application/skill-contracts";
import { cursorScope, page, readCursor, nameKey } from "../domain/skill-policy";

@Injectable()
export class SkillsRepository {
  constructor(private readonly db: PrismaService) {}
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
