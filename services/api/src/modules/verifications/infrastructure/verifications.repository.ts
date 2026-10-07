import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import type {
  Prisma,
  VerificationRequestStatus,
} from "../../../generated/prisma/client";
import {
  cursorScope,
  readCursor,
  page,
  verificationBadge,
} from "../../skills/domain/skill-policy";
const include = {
  skillEvidenceSubmissionRecords: { orderBy: { id: "asc" } },
} satisfies Prisma.SkillVerificationInclude;
type VerificationRow = Prisma.SkillVerificationGetPayload<{
  include: typeof include;
}>;
export function verificationView(row: VerificationRow) {
  return {
    id: row.id,
    sharingSkillId: row.sharingSkillId,
    status: row.status,
    version: row.version,
    reviewerId: row.reviewerId,
    reviewedAt: row.reviewedAt,
    rejectReason: row.rejectReason,
    note: row.note,
    submittedAt: row.submittedAt,
    files: row.skillEvidenceSubmissionRecords.map((file) => ({
      id: file.id,
      title: file.title,
      description: file.description,
      mimeType: file.mimeType,
      fileSizeBytes: file.fileSizeBytes.toString(),
      approvalStatus: file.approvalStatus,
      approvedAt: file.approvedAt,
      reviewerId: file.reviewerId,
      reviewedAt: file.reviewedAt,
      rejectReason: file.rejectReason,
      revokedAt: file.revokedAt,
      revokedReason: file.revokedReason,
      revokedByUserId: file.revokedByUserId,
    })),
  };
}
@Injectable()
export class VerificationsRepository {
  constructor(private readonly db: PrismaService) {}
  async get(id: string, tx: TransactionContext = this.db, lock = false) {
    if (lock)
      await tx.$queryRaw`SELECT verification_id FROM skill_verifications WHERE verification_id=${id}::uuid FOR UPDATE`;
    const row = await tx.skillVerification.findUnique({
      where: { id },
      include,
    });
    if (!row) throw new NotFoundException();
    return row;
  }
  create(
    tx: TransactionContext,
    data: Prisma.SkillVerificationUncheckedCreateInput,
  ) {
    return tx.skillVerification.create({ data });
  }
  async forEvidence(evidenceId: string) {
    const file = await this.db.skillEvidence.findUnique({
      where: { id: evidenceId },
    });
    if (!file) throw new NotFoundException();
    return this.get(file.verificationId);
  }
  addEvidence(
    tx: TransactionContext,
    data: Prisma.SkillEvidenceUncheckedCreateInput,
  ) {
    return tx.skillEvidence.create({ data });
  }
  pending(tx: TransactionContext, sharingSkillId: string) {
    return tx.skillVerification.count({
      where: { sharingSkillId, status: "PENDING" },
    });
  }
  async badge(tx: TransactionContext, sharingSkillId: string) {
    const [approved, pending, submitted] = await Promise.all([
      tx.skillEvidence.count({
        where: {
          sharingSkillId,
          approvalStatus: "APPROVED",
          revokedAt: null,
          storedFileId: { not: null },
        },
      }),
      this.pending(tx, sharingSkillId),
      tx.skillVerification.count({ where: { sharingSkillId } }),
    ]);
    return verificationBadge(approved, pending, submitted);
  }
  decision(
    tx: TransactionContext,
    id: string,
    status: VerificationRequestStatus,
    reviewerId: string,
    at: Date,
    reason?: string,
    note?: string,
  ) {
    return tx.skillVerification.update({
      where: { id },
      data: {
        status,
        reviewerId,
        reviewedAt: at,
        rejectReason: reason ?? null,
        note: note ?? null,
        version: { increment: 1 },
      },
    });
  }
  decideFiles(
    tx: TransactionContext,
    verificationId: string,
    approved: boolean,
    reviewerId: string,
    at: Date,
    reason?: string,
  ) {
    return tx.skillEvidence.updateMany({
      where: { verificationId, approvalStatus: "PENDING" },
      data: {
        approvalStatus: approved ? "APPROVED" : "REJECTED",
        reviewerId,
        reviewedAt: at,
        ...(approved ? { approvedAt: at } : { rejectReason: reason }),
      },
    });
  }
  revoke(tx: TransactionContext, id: string, actor: string, reason: string) {
    return tx.skillEvidence.update({
      where: { id },
      data: {
        approvalStatus: "REVOKED",
        revokedByUserId: actor,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }
  async list(query: {
    sharingSkillId?: string;
    status?: VerificationRequestStatus;
    cursor?: string;
    limit: number;
  }) {
    const scope = cursorScope({
      type: "verifications",
      sharingSkillId: query.sharingSkillId ?? null,
      status: query.status ?? null,
    });
    const cursor = readCursor(query.cursor, scope);
    if (
      cursor &&
      (!/^\d{4}-\d\d-\d\dT.*Z$/u.test(cursor.value) ||
        !Number.isFinite(new Date(cursor.value).getTime()))
    )
      throw new BadRequestException("INVALID_CURSOR");
    const rows = await this.db.skillVerification.findMany({
      where: {
        ...(query.sharingSkillId
          ? { sharingSkillId: query.sharingSkillId }
          : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(cursor
          ? {
              OR: [
                { submittedAt: { lt: new Date(cursor.value) } },
                { submittedAt: new Date(cursor.value), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include,
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
    });
    const result = page(rows, query.limit, scope, (row) =>
      row.submittedAt.toISOString(),
    );
    return { ...result, data: result.data.map(verificationView) };
  }
}
