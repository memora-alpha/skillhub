import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import type { Prisma } from "../../../generated/prisma/client";
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
  async list(userId: string, query: SharingQuery, publicOnly = false) {
    const scope = cursorScope({
      type: "sharing",
      userId,
      publicOnly,
      archived: query.includeArchived ?? false,
    });
    const cursor = readCursor(query.cursor, scope);
    const rows = await this.db.sharingSkill.findMany({
      where: {
        userId,
        ...(publicOnly
          ? {
              isVisible: true,
              archivedAt: null,
              userIdRecord: { accountStatus: "ACTIVE" },
              skillIdRecord: { status: "ACTIVE" },
            }
          : query.includeArchived
            ? {}
            : { archivedAt: null }),
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
