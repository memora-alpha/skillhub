import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { CreditWalletReader } from "./credit-wallet.reader";
import { CreditLedgerService } from "./credit-ledger.service";

@Module({
  imports: [DatabaseModule],
  providers: [CreditWalletReader, CreditLedgerService],
  exports: [CreditWalletReader, CreditLedgerService],
})
export class CreditModule {}
