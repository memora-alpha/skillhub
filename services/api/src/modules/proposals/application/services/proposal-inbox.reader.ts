import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../../generated/prisma/client";

/** Parameterized read projection owned by Proposals, composed before pagination.
 * Only the viewer's own rows contribute; statuses deliberately include history.
 */
@Injectable()
export class ProposalInboxReader {
  groupedProjection(userId: string): Prisma.Sql {
    return Prisma.sql`
      SELECT request_id,
        COUNT(*) FILTER (WHERE recipient_id = ${userId}::uuid)::int AS received_count,
        COUNT(*) FILTER (WHERE proposer_id = ${userId}::uuid)::int AS sent_count,
        MAX(created_at) AS last_activity_at
      FROM proposals
      WHERE request_id IS NOT NULL
        AND (recipient_id = ${userId}::uuid OR proposer_id = ${userId}::uuid)
      GROUP BY request_id`;
  }
}
