import { Injectable, NotFoundException } from "@nestjs/common";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { NotificationAccessService } from "../services/notification-access.service";

@Injectable()
export class PushTokensUseCases {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly access: NotificationAccessService,
  ) {}

  /** A browser token belongs to whoever registered it last, so a shared device follows its current user. */
  register(principal: Principal, token: string) {
    return this.transactions.run(async (tx) => {
      const live = await this.access.assertAction(
        tx,
        principal,
        "notification:update:self",
      );
      const now = new Date();
      return tx.pushDeviceToken.upsert({
        where: { token },
        create: { userId: live.userId, token, lastSeenAt: now },
        update: { userId: live.userId, lastSeenAt: now, revokedAt: null },
        select: { id: true },
      });
    });
  }

  unregister(principal: Principal, id: string) {
    return this.transactions.run(async (tx) => {
      const live = await this.access.assertAction(
        tx,
        principal,
        "notification:update:self",
      );
      const { count } = await tx.pushDeviceToken.updateMany({
        where: { id, userId: live.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) throw new NotFoundException("PUSH_TOKEN_NOT_FOUND");
    });
  }
}
