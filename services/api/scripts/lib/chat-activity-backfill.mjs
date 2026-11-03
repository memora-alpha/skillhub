import { Prisma } from "../../dist/generated/prisma/client.js";

async function backfillPage(db, mongoDb, after, batchSize) {
  const rows = await db.conversation.findMany({
    where: after ? { id: { gt: after } } : {},
    orderBy: { id: "asc" },
    take: batchSize,
    select: { id: true },
  });
  if (!rows.length) return null;
  const summaries = await mongoDb
    .aggregate(
      [
        { $documents: rows.map((row) => ({ _id: row.id })) },
        {
          $lookup: {
            from: "chat_messages",
            let: { conversation: "$_id" },
            as: "last",
            pipeline: [
              {
                $match: {
                  status: "PUBLISHED",
                  $expr: { $eq: ["$conversationId", "$$conversation"] },
                },
              },
              { $sort: { sequence: -1 } },
              { $limit: 1 },
              { $project: { _id: 0, sentAt: 1 } },
            ],
          },
        },
      ],
      { maxTimeMS: 5000, readConcern: { level: "majority" } },
    )
    .toArray();
  if (summaries.length !== rows.length)
    throw new Error("INCOMPLETE_CHAT_ACTIVITY_BATCH");
  const updates = [];
  for (const summary of summaries) {
    if (!summary.last.length) continue;
    const sentAt = summary.last[0]?.sentAt;
    if (!(sentAt instanceof Date) || !Number.isFinite(sentAt.getTime()))
      throw new Error("INVALID_PUBLISHED_MESSAGE_TIME");
    updates.push(Prisma.sql`(${summary._id}::uuid, ${sentAt}::timestamptz)`);
  }
  let updated = 0;
  if (updates.length) {
    // One parameterized write per page. PostgreSQL rechecks this predicate under
    // row locks so a concurrent live delivery can never be moved backwards.
    updated = await db.$executeRaw(Prisma.sql`
        UPDATE conversations AS c SET last_activity_at = activity.sent_at
        FROM (VALUES ${Prisma.join(updates)}) AS activity(conversation_id, sent_at)
        WHERE c.conversation_id = activity.conversation_id
          AND c.last_activity_at < activity.sent_at
      `);
  }
  return { after: rows.at(-1).id, scanned: rows.length, updated };
}

/** Bounded keyset rebuild. Mongo reads never run in a PG transaction. */
export async function backfillChatActivity(db, mongoDb, batchSize = 100) {
  let after;
  let scanned = 0;
  let updated = 0;
  for (;;) {
    // Deliberately sequential: the next page needs this page's final ID and must
    // not advance until its SQL batch succeeds. Keep at most one page in memory.
    const page = await backfillPage(db, mongoDb, after, batchSize);
    if (!page) return { scanned, updated };
    scanned += page.scanned;
    updated += page.updated;
    after = page.after;
  }
}
