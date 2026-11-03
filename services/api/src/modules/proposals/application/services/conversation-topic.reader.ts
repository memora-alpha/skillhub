import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

/** Proposal owner exposes only source labels to already-authorized Conversation readers. */
@Injectable()
export class ConversationTopicReader {
  async read(tx: TransactionContext, proposalIds: string[]) {
    if (!proposalIds.length) return new Map<string, string>();
    const rows = await tx.proposal.findMany({
      where: { id: { in: proposalIds } },
      select: {
        id: true,
        requestIdRecord: { select: { title: true } },
        skillIdRecord: { select: { name: true } },
      },
    });
    return new Map(
      rows.map((row) => [
        row.id,
        row.requestIdRecord?.title ?? row.skillIdRecord.name,
      ]),
    );
  }
}
