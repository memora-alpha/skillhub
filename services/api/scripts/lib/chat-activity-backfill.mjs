/** Resumable, bounded projection rebuild. Mongo reads never run in a PG transaction. */
export async function backfillChatActivity(db, mongoDb, batchSize = 100) {
  let after;
  let scanned = 0;
  let updated = 0;
  for (;;) {
    const rows = await db.conversation.findMany({
      where: after ? { id: { gt: after } } : {},
      orderBy: { id: "asc" },
      take: batchSize,
      select: { id: true },
    });
    if (!rows.length) break;
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
    for (const summary of summaries) {
      const sentAt = summary.last[0]?.sentAt;
      if (!summary.last.length) continue;
      if (!(sentAt instanceof Date) || !Number.isFinite(sentAt.getTime()))
        throw new Error("INVALID_PUBLISHED_MESSAGE_TIME");
      // A live delivery can race this rebuild; never overwrite a newer timestamp.
      const result = await db.conversation.updateMany({
        where: { id: summary._id, lastActivityAt: { lt: sentAt } },
        data: { lastActivityAt: sentAt },
      });
      updated += result.count;
    }
    scanned += rows.length;
    after = rows.at(-1).id;
  }
  return { scanned, updated };
}
