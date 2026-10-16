import { Injectable } from "@nestjs/common";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import { LedgerCursor } from "../../domain/ledger-cursor";
import type { LedgerPage, LedgerQuery } from "../contracts/wallet";
import { WalletRepository } from "../ports/wallet-repository";
import { ledgerEntryView } from "../services/ledger-entry.mapper";

@Injectable()
export class ListCreditTransactionsUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly actors: SkillActorService,
    private readonly repository: WalletRepository,
    private readonly cursors: LedgerCursor,
  ) {}

  execute(principal: Principal, query: LedgerQuery): Promise<LedgerPage> {
    return this.transactions.run(async (tx) => {
      await this.actors.require(tx, principal);
      const scope = {
        userId: principal.userId,
        type: query.type,
        referenceType: query.referenceType,
      };
      const boundary = query.cursor
        ? this.cursors.decode(query.cursor, scope)
        : {
            watermark:
              (await this.repository.get(tx, principal.userId))
                ?.lastEntrySequence ?? 0n,
          };
      const rows = await this.repository.list(
        tx,
        principal.userId,
        query,
        boundary,
        query.limit,
      );
      const visible = rows.slice(0, query.limit);
      const hasMore = rows.length > query.limit;
      const last = visible.at(-1);
      return {
        data: visible.map(ledgerEntryView),
        pagination: {
          limit: query.limit,
          hasMore,
          nextCursor:
            hasMore && last
              ? this.cursors.encode(
                  scope,
                  boundary.watermark,
                  last.entrySequence,
                )
              : null,
        },
      };
    });
  }
}
