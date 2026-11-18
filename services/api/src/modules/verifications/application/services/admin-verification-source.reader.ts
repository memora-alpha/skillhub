import { Prisma } from "../../../../generated/prisma/client";
import {
  adminWorkSourceQuery,
  type AdminWorkSourcePage,
} from "../../../administration/application/contracts/admin-work-source-page";
import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  AdminVerificationReaderPort,
  type AdminVerificationWorkRow,
} from "../ports/admin-verification.reader";

@Injectable()
export class AdminVerificationSourceReader extends AdminVerificationReaderPort {
  pendingWork(tx: TransactionContext, page: AdminWorkSourcePage) {
    return tx.$queryRaw<AdminVerificationWorkRow[]>(
      adminWorkSourceQuery(
        Prisma.sql`SELECT
        verification_id AS id,
        sharing_skill_id AS "sharingSkillId",
        status::text AS status,
        reviewer_id AS "reviewerId",
        note,
        submitted_at AS "submittedAt",
        submitted_at AS "receivedAt",
        version,
        'Skill verification ' || left(verification_id::text, 8) AS title,
        NULL::text AS reason,
        'UNCLASSIFIED'::text AS severity,
        reviewer_id AS assignee
      FROM skill_verifications WHERE status = 'PENDING'`,
        "SKILL_VERIFICATION",
        page,
      ),
    );
  }

  detail(tx: TransactionContext, id: string) {
    return tx.skillVerification.findUnique({
      where: { id },
      select: {
        id: true,
        sharingSkillId: true,
        status: true,
        reviewerId: true,
        note: true,
        submittedAt: true,
        version: true,
      },
    });
  }

  pendingCount(tx: TransactionContext) {
    return tx.skillVerification.count({ where: { status: "PENDING" } });
  }
}
