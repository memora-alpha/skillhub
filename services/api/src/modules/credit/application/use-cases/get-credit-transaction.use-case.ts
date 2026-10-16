import { Injectable, NotFoundException } from "@nestjs/common";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import type { LedgerEntryView } from "../contracts/wallet";
import { WalletRepository } from "../ports/wallet-repository";
import { ledgerEntryView } from "../services/ledger-entry.mapper";

@Injectable()
export class GetCreditTransactionUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly actors: SkillActorService,
    private readonly repository: WalletRepository,
  ) {}

  execute(principal: Principal, id: string): Promise<LedgerEntryView> {
    return this.transactions.run(async (tx) => {
      await this.actors.require(tx, principal);
      const row = await this.repository.detail(tx, principal.userId, id);
      if (!row) throw new NotFoundException("CREDIT_TRANSACTION_NOT_FOUND");
      return ledgerEntryView(row);
    });
  }
}
