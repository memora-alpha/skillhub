import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { CreditWalletReader } from "./credit-wallet.reader";
import { CreditLedgerService } from "./credit-ledger.service";
import { CreditLedgerAdapter } from "./credit-ledger.adapter";
import {
  CreditAdjustmentPort,
  PathSettlementPort,
  WalletPort,
} from "./credit.ports";
import { UnavailableCreditAdjustmentAdapter } from "./unavailable-credit-adjustment.adapter";

@Module({
  imports: [DatabaseModule],
  providers: [
    CreditWalletReader,
    CreditLedgerService,
    CreditLedgerAdapter,
    { provide: WalletPort, useExisting: CreditLedgerAdapter },
    { provide: PathSettlementPort, useExisting: CreditLedgerAdapter },
    {
      provide: CreditAdjustmentPort,
      useClass: UnavailableCreditAdjustmentAdapter,
    },
  ],
  exports: [
    CreditWalletReader,
    CreditLedgerService,
    WalletPort,
    PathSettlementPort,
    CreditAdjustmentPort,
  ],
})
export class CreditModule {}
