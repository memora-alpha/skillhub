import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import { Prisma } from "../../../generated/prisma/client";
import {
  cursorScope,
  readCursor,
  page,
} from "../../skills/domain/skill-policy";
export type SharingQuery = {
  limit: number;
  cursor?: string;
  includeArchived?: boolean;
  verifiedOnly?: boolean;
};
const include = {
  skillIdRecord: true,
  skillVerificationSharingSkillIdRecords: {
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    take: 1,
  },
} satisfies Prisma.SharingSkillInclude;
type SharingRow = Prisma.SharingSkillGetPayload<{ include: typeof include }>;
export function publicSharing(row: SharingRow) {
  return {
    id: row.id,
    skill: row.skillIdRecord,
    level: row.level,
    description: row.description,
    experienceYears: row.experienceYears?.toFixed(1) ?? null,
    verificationStatus: row.verificationStatus,
  };
}
export function ownSharing(row: SharingRow) {
  return {
    ...publicSharing(row),
    isVisible: row.isVisible,
    archivedAt: row.archivedAt,
    version: row.version,
    latestVerification: row.skillVerificationSharingSkillIdRecords[0] ?? null,
  };
}
@Injectable()
export class SharingSkillsRepository {
  constructor(private readonly db: PrismaService) {}
  requestSelection(tx: TransactionContext, ids: readonly string[]) {
    return tx.sharingSkill.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, userId: true, skillId: true },
    });
  }
  lockRequestSelection(tx: TransactionContext, ids: readonly string[]) {
    return tx.$queryRaw<
      {
        id: string;
        userId: string;
        skillId: string;
        archivedAt: Date | null;
        isVisible: boolean;
      }[]
    >(Prisma.sql`
      SELECT sharing_skill_id AS id, user_id AS "userId", skill_id AS "skillId",
             archived_at AS "archivedAt", is_visible AS "isVisible"
      FROM sharing_skills
      WHERE sharing_skill_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY sharing_skill_id
      FOR UPDATE
    `);
  }
  async requestOfferings(tx: TransactionContext, ids: readonly string[]) {
    if (ids.length === 0) return [];
    const rows = await tx.sharingSkill.findMany({
      where: {
        id: { in: [...ids] },
        archivedAt: null,
        isVisible: true,
        skillIdRecord: { status: "ACTIVE" },
        userIdRecord: { accountStatus: "ACTIVE" },
      },
      select: {
        id: true,
        userId: true,
        level: true,
        verificationStatus: true,
        skillIdRecord: { select: { id: true, name: true } },
      },
      orderBy: { id: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      ownerId: row.userId,
      skill: row.skillIdRecord,
      level: row.level,
      verificationStatus: row.verificationStatus,
    }));
  }
  async matchingSnapshot(tx: TransactionContext, userId: string) {
    const rows = await tx.sharingSkill.findMany({
      where: { userId, archivedAt: null, skillIdRecord: { status: "ACTIVE" } },
      select: { id: true, skillId: true, version: true },
      orderBy: { id: "asc" },
    });
    return {
      skillIds: rows.map((row) => row.skillId),
      tagIds: [],
      version: cursorScope(rows),
    };
  }
  async get(id: string, tx: TransactionContext = this.db, lock = false) {
    if (lock)
      await tx.$queryRaw`SELECT sharing_skill_id FROM sharing_skills WHERE sharing_skill_id=${id}::uuid FOR UPDATE`;
    const row = await tx.sharingSkill.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException();
    return row;
  }
  create(
    tx: TransactionContext,
    data: Prisma.SharingSkillUncheckedCreateInput,
  ) {
    return tx.sharingSkill.create({ data, include });
  }
  update(
    tx: TransactionContext,
    id: string,
    data: Prisma.SharingSkillUncheckedUpdateInput,
  ) {
    return tx.sharingSkill.update({ where: { id }, data, include });
  }
  count(tx: TransactionContext, userId: string) {
    return tx.sharingSkill.count({
      where: { userId, archivedAt: null, verificationStatus: "VERIFIED" },
    });
  }
  findUnarchived(tx: TransactionContext, userId: string, skillId: string) {
    return tx.sharingSkill.findFirst({
      where: { userId, skillId, archivedAt: null },
      select: { id: true },
    });
  }
  async list(userId: string, query: SharingQuery, publicOnly = false) {
    const scope = cursorScope({
      type: "sharing",
      userId,
      publicOnly,
      archived: query.includeArchived ?? false,
    });
    const cursor = readCursor(query.cursor, scope);
    let visibility: Prisma.SharingSkillWhereInput = query.includeArchived
      ? {}
      : { archivedAt: null };
    if (publicOnly) {
      visibility = {
        isVisible: true,
        archivedAt: null,
        userIdRecord: { accountStatus: "ACTIVE" },
        skillIdRecord: { status: "ACTIVE" },
      };
    }
    const rows = await this.db.sharingSkill.findMany({
      where: {
        userId,
        ...visibility,
        ...(cursor ? { id: { gt: cursor.id } } : {}),
      },
      include,
      orderBy: { id: "asc" },
      take: query.limit + 1,
    });
    const result = page(rows, query.limit, scope, (row) => row.id);
    return {
      ...result,
      data: result.data.map(publicOnly ? publicSharing : ownSharing),
    };
  }
  async search(skillId: string, query: SharingQuery) {
    const scope = cursorScope({
      type: "sharers",
      skillId,
      verified: query.verifiedOnly ?? false,
    });
    const cursor = readCursor(query.cursor, scope);
    return page(
      await this.db.sharingSkill.findMany({
        where: {
          skillId,
          archivedAt: null,
          isVisible: true,
          skillIdRecord: { status: "ACTIVE" },
          userIdRecord: { accountStatus: "ACTIVE" },
          ...(query.verifiedOnly ? { verificationStatus: "VERIFIED" } : {}),
          ...(cursor ? { id: { gt: cursor.id } } : {}),
        },
        include,
        orderBy: { id: "asc" },
        take: query.limit + 1,
      }),
      query.limit,
      scope,
      (row) => row.id,
    );
  }
  eligible(
    tx: TransactionContext,
    userId: string,
    skillId: string,
    verifiedRequired: boolean,
  ) {
    return tx.sharingSkill.findFirst({
      where: {
        userId,
        skillId,
        archivedAt: null,
        userIdRecord: { accountStatus: "ACTIVE" },
        skillIdRecord: { status: "ACTIVE" },
        ...(verifiedRequired ? { verificationStatus: "VERIFIED" } : {}),
      },
    });
  }
}
