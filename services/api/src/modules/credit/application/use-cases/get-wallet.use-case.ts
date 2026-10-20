import { Injectable } from "@nestjs/common";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import { formatCredit } from "../../domain/money";
import type { WalletView } from "../contracts/wallet";
import { WalletRepository } from "../ports/wallet-repository";

@Injectable()
export class GetWalletUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly actors: SkillActorService,
    private readonly repository: WalletRepository,
  ) {}

  execute(principal: Principal): Promise<WalletView> {
    return this.transactions.run(async (tx) => {
      await this.actors.require(tx, principal);
      const row = await this.repository.get(tx, principal.userId);
      return {
        availableCredit: formatCredit(row?.availableCredit ?? 0n),
        heldCredit: formatCredit(row?.heldCredit ?? 0n),
        walletVersion: row?.walletVersion ?? 0,
      };
    });
  }
}
