import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../../infrastructure/database/prisma.service";

import {
  lockUsers,
  transaction,
} from "../../../../shared/database/identity-transactions";

import { AvatarRepository } from "../ports/avatar-repository";

@Injectable()
export class RemoveAvatarUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly repository: AvatarRepository,
  ) {}
  async execute(userId: string) {
    await transaction(this.db, async (tx) => {
      await lockUsers(tx, [userId]);
      await this.repository.select(tx, userId, null);
      // Clear also cancels pending uploads so a delayed worker cannot restore one.
      await this.repository.cancelUser(tx, userId);
    });
  }
}
