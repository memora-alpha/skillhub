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
import { CreditLedgerAdapter } from "./credit-ledger.adapter";
import {
  CreditAdjustmentPort,
  PathSettlementPort,
  WalletPort,
} from "./credit.ports";
import { UnavailableCreditAdjustmentAdapter } from "./unavailable-credit-adjustment.adapter";
import { CreditOperationsService } from "./application/services/credit-operations.service";
import { CreditProvenanceService } from "./application/services/credit-provenance.service";

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [WalletController],
  providers: [
    CreditWalletReader,
    CreditProvenanceService,
    CreditOperationsService,
    CreditLedgerService,
    CreditLedgerAdapter,
    { provide: WalletPort, useExisting: CreditLedgerAdapter },
    { provide: PathSettlementPort, useExisting: CreditLedgerAdapter },
    {
      provide: CreditAdjustmentPort,
      useClass: UnavailableCreditAdjustmentAdapter,
    },
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
  exports: [
    CreditOperationsService,
    CreditWalletReader,
    CreditLedgerService,
    WalletPort,
    PathSettlementPort,
    CreditAdjustmentPort,
  ],
})
export class CreditModule {}
