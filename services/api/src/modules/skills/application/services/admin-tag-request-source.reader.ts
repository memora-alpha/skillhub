import { Prisma } from "../../../../generated/prisma/client";
import {
  adminWorkSourceQuery,
  type AdminWorkSourcePage,
} from "../../../administration/application/contracts/admin-work-source-page";
import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import {
  AdminTagRequestReaderPort,
  type AdminTagRequestWorkRow,
} from "../ports/admin-tag-request.reader";

@Injectable()
export class AdminTagRequestSourceReader extends AdminTagRequestReaderPort {
  pendingWork(tx: TransactionContext, page: AdminWorkSourcePage) {
    return tx.$queryRaw<AdminTagRequestWorkRow[]>(
      adminWorkSourceQuery(
        Prisma.sql`SELECT
        tag_request_id AS id,
        label,
        status::text AS status,
        requested_by_user_id AS "requestedByUserId",
        reviewed_by_user_id AS "reviewedByUserId",
        created_at AS "createdAt",
        created_at AS "receivedAt",
        version,
        label AS title,
        NULL::text AS reason,
        'UNCLASSIFIED'::text AS severity,
        reviewed_by_user_id AS assignee
      FROM tag_creation_requests WHERE status = 'PENDING'`,
        "TAG_REQUEST",
        page,
      ),
    );
  }

  detail(tx: TransactionContext, id: string) {
    return tx.tagCreationRequest.findUnique({
      where: { id },
      select: {
        id: true,
        label: true,
        status: true,
        requestedByUserId: true,
        reviewedByUserId: true,
        createdAt: true,
        version: true,
      },
    });
  }

  pendingCount(tx: TransactionContext) {
    return tx.tagCreationRequest.count({ where: { status: "PENDING" } });
  }
}
