import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { transaction } from "../../../../shared/database/identity-transactions";
import { Injectable } from "@nestjs/common";
import { Principal } from "../../../auth/application/services/sessions.service";
import { AccountModerationService } from "../services/account-moderation.service";
@Injectable()
export class UnlockUserUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly change: AccountModerationService,
  ) {}
  execute(actor: Principal, userId: string, reason: string) {
    return transaction(this.db, (tx) =>
      this.change.execute(tx, actor, userId, false, reason),
    );
  }
}
