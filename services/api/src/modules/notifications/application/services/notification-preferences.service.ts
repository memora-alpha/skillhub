import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { Injectable } from "@nestjs/common";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import {
  SessionsService,
  type Principal,
} from "../../../auth/application/services/sessions.service";
import { lockUsers } from "../../../../shared/database/identity-transactions";
import {
  notificationPreferences,
  type NotificationPreferences,
} from "../../domain/notification-preferences";
@Injectable()
export class NotificationPreferencesService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly sessions: SessionsService,
  ) {}
  read(actor: Principal) {
    return this.transactions.run(async (tx) => {
      const live = await this.sessions.assertLive(tx, actor);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: live.userId },
        select: { notificationPreferences: true },
      });
      return notificationPreferences(user.notificationPreferences);
    });
  }
  update(actor: Principal, patch: Partial<NotificationPreferences>) {
    const parsed = z
      .strictObject({
        learning: z.boolean().optional(),
        credit: z.boolean().optional(),
        community: z.boolean().optional(),
      })
      .safeParse(patch);
    if (!parsed.success)
      throw new BadRequestException("INVALID_NOTIFICATION_PREFERENCES");
    patch = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined),
    );
    return this.transactions.run(async (tx) => {
      await this.sessions.assertLive(tx, actor);
      await lockUsers(tx, [actor.userId]);
      await this.sessions.assertLive(tx, actor);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: actor.userId },
        select: { notificationPreferences: true },
      });
      const preferences = {
        ...notificationPreferences(user.notificationPreferences),
        ...patch,
      };
      await tx.user.update({
        where: { id: actor.userId },
        data: { notificationPreferences: preferences },
      });
      return preferences;
    });
  }
}
