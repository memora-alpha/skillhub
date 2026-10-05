import { UsersService } from "../services/users.service";
import { UsersRepository } from "../ports/users-repository";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";

import { ProfileReader } from "../services/profile-reader.service";

@Injectable()
export class GetOwnIdentityUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly repository: UsersRepository,
    private readonly users: UsersService,
    private readonly profiles: ProfileReader,
  ) {}
  async execute(userId: string) {
    const user = await this.repository.requiredUser(this.db, userId);
    const grants = await this.users.grants(this.db, userId);
    return {
      userId,
      email: user.normalizedEmail,
      emailVerified: user.emailVerified,
      accountStatus: user.accountStatus,
      roles: grants.roles,
      profile: await this.profiles.profile(userId),
    };
  }
}
