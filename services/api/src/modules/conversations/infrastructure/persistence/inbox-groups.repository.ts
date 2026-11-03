import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../../generated/prisma/client";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

export type InboxGroupRow = {
  key: string;
  groupType: "LEARNING_REQUEST" | "DIRECT_CONVERSATION";
  learningRequestId: string | null;
  conversationId: string | null;
  sourceProposalId: string | null;
  receivedProposalCount: number;
  sentProposalCount: number;
  conversationCount: number;
  lastActivityAt: Date;
};

@Injectable()
export class InboxGroupsRepository {
  page(
    tx: TransactionContext,
    userId: string,
    proposalProjection: Prisma.Sql,
    limit: number,
    cursor?: { key: string; at: Date },
  ) {
    // Aggregate complete, independently scoped sets before joining. Joining raw
    // proposals to raw conversations would multiply both counts.
    return tx.$queryRaw<InboxGroupRow[]>(Prisma.sql`
      WITH proposal_groups AS (${proposalProjection}),
      conversation_groups AS (
        SELECT request_id, COUNT(*)::int AS conversation_count,
          MAX(last_activity_at) AS last_activity_at
        FROM conversations
        WHERE request_id IS NOT NULL
          AND (participant_a_id = ${userId}::uuid OR participant_b_id = ${userId}::uuid)
        GROUP BY request_id
      ), request_groups AS (
        SELECT 'request:' || COALESCE(c.request_id, p.request_id)::text AS key,
          'LEARNING_REQUEST'::text AS "groupType",
          COALESCE(c.request_id, p.request_id)::text AS "learningRequestId",
          NULL::text AS "conversationId", NULL::text AS "sourceProposalId",
          COALESCE(p.received_count, 0) AS "receivedProposalCount",
          COALESCE(p.sent_count, 0) AS "sentProposalCount",
          COALESCE(c.conversation_count, 0) AS "conversationCount",
          GREATEST(c.last_activity_at, p.last_activity_at) AS "lastActivityAt"
        FROM conversation_groups c FULL JOIN proposal_groups p ON c.request_id = p.request_id
        WHERE COALESCE(c.conversation_count, 0) > 0 OR COALESCE(p.received_count, 0) > 0
      ), direct_groups AS (
        SELECT 'conversation:' || conversation_id::text AS key,
          'DIRECT_CONVERSATION'::text AS "groupType", NULL::text AS "learningRequestId",
          conversation_id::text AS "conversationId", proposal_id::text AS "sourceProposalId",
          0::int AS "receivedProposalCount", 0::int AS "sentProposalCount",
          1::int AS "conversationCount", last_activity_at AS "lastActivityAt"
        FROM conversations
        WHERE request_id IS NULL
          AND (participant_a_id = ${userId}::uuid OR participant_b_id = ${userId}::uuid)
      ), inbox_rows AS (SELECT * FROM request_groups UNION ALL SELECT * FROM direct_groups)
      SELECT * FROM inbox_rows
      ${
        cursor
          ? Prisma.sql`WHERE ("lastActivityAt" < ${cursor.at}
        OR ("lastActivityAt" = ${cursor.at} AND key < ${cursor.key}))`
          : Prisma.empty
      }
      ORDER BY "lastActivityAt" DESC, key DESC LIMIT ${limit + 1}
    `);
  }
}
