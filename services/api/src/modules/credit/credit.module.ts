import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { CreditWalletReader } from "./credit-wallet.reader";
import { CreditLedgerService } from "./credit-ledger.service";
import { CreditLedgerAdapter } from "./credit-ledger.adapter";
import { PathSettlementPort, WalletPort } from "./credit.ports";

@Module({
  imports: [DatabaseModule],
  providers: [
    CreditWalletReader,
    CreditLedgerService,
    CreditLedgerAdapter,
    { provide: WalletPort, useExisting: CreditLedgerAdapter },
    { provide: PathSettlementPort, useExisting: CreditLedgerAdapter },
  ],
  exports: [
    CreditWalletReader,
    CreditLedgerService,
    WalletPort,
    PathSettlementPort,
  ],
})
export class CreditModule {}
