import { Injectable } from "@nestjs/common";

import { IdentityConfig } from "../../../../configs/identity.config";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  lockUsers,
  transaction,
} from "../../../../shared/database/identity-transactions";

import { AuthRepository } from "../ports/auth-repository";

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly config: IdentityConfig,
    private readonly repository: AuthRepository,
  ) {}
  async execute(token: string) {
    const credential = await this.repository.credential(
      this.db,
      this.config.crypto.secretDigest(token),
    );
    if (!credential) return;
    await transaction(this.db, async (tx) => {
      await lockUsers(tx, [credential.session.userId]);
      await this.repository.logoutFamily(tx, credential.sessionId);
    });
  }
}
