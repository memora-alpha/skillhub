import { SessionsService } from "../services/sessions.service";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  lockUsers,
  transaction,
} from "../../../../shared/database/identity-transactions";

@Injectable()
export class LogoutAllUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly sessions: SessionsService,
  ) {}
  async execute(userId: string) {
    await transaction(this.db, async (tx) => {
      await lockUsers(tx, [userId]);
      await this.sessions.revoke(tx, userId, "LOGOUT_ALL");
    });
  }
}
