import { UsersRepository } from "../ports/users-repository";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";

import {
  lockUsers,
  transaction,
} from "../../../../shared/database/identity-transactions";

import { ProfileReader } from "../services/profile-reader.service";
import { ProfileChange } from "../contracts/profile-change";
@Injectable()
export class UpdateProfileUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly repository: UsersRepository,
    private readonly profiles: ProfileReader,
  ) {}
  async execute(userId: string, data: ProfileChange) {
    await transaction(this.db, async (tx) => {
      await lockUsers(tx, [userId]);
      await this.repository.updateProfile(tx, userId, data);
    });
    return this.profiles.profile(userId);
  }
}
