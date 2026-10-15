import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { CreditWalletReader } from "./application/services/credit-wallet.reader";
import { CreditLedgerService } from "./application/services/credit-ledger.service";
import { IdentityModule } from "../identity.module";
import { IdentityConfig } from "../../configs/identity.config";
import { WalletRepository } from "./application/ports/wallet-repository";
import { PrismaWalletRepository } from "./infrastructure/persistence/prisma-wallet.repository";
import { GetWalletUseCase } from "./application/use-cases/get-wallet.use-case";
import { ListCreditTransactionsUseCase } from "./application/use-cases/list-credit-transactions.use-case";
import { GetCreditTransactionUseCase } from "./application/use-cases/get-credit-transaction.use-case";
import { LedgerCursor } from "./domain/ledger-cursor";
import { WalletController } from "./presentation/http/wallet.controller";

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [WalletController],
  providers: [
    CreditWalletReader,
    CreditLedgerService,
    { provide: WalletRepository, useClass: PrismaWalletRepository },
    GetWalletUseCase,
    ListCreditTransactionsUseCase,
    GetCreditTransactionUseCase,
    {
      provide: LedgerCursor,
      inject: [IdentityConfig],
      useFactory: (config: IdentityConfig) => new LedgerCursor(config.jwtKey),
    },
  ],
  exports: [CreditWalletReader, CreditLedgerService],
})
export class CreditModule {}
