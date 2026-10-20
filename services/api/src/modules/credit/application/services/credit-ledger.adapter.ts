import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { CreditLedgerService } from "./credit-ledger.service";
import type { PathHoldInput } from "../contracts/path-credit";
import { CreditWalletReader } from "./credit-wallet.reader";
import type { PathSettlementPort, WalletPort } from "../ports/credit.ports";

@Injectable()
export class CreditLedgerAdapter implements WalletPort, PathSettlementPort {
  constructor(
    private readonly wallets: CreditWalletReader,
    private readonly ledger: CreditLedgerService,
  ) {}

  availableBalances(tx: TransactionContext, userIds: readonly string[]) {
    return this.wallets.balances(tx, userIds);
  }

  async holdForPath(tx: TransactionContext, input: PathHoldInput) {
    return { operationId: await this.ledger.holdPath(tx, input) };
  }

  settlePath(
    tx: TransactionContext,
    input: Parameters<PathSettlementPort["settlePath"]>[1],
  ) {
    return this.ledger.settlePath(tx, input);
  }
}
