import { Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

@Injectable()
export class CreditWalletReader {
  balances(tx: TransactionContext, userIds: readonly string[]) {
    return tx.creditWallet.findMany({
      where: { userId: { in: [...userIds] } },
      select: { userId: true, availableCredit: true, heldCredit: true },
    });
  }
}
