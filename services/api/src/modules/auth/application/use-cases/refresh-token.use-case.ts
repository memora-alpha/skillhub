import { SessionsService } from "../services/sessions.service";
import { Injectable, UnauthorizedException } from "@nestjs/common";

import { IdentityConfig } from "../../../../configs/identity.config";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  lockUsers,
  transaction,
} from "../../../../shared/database/identity-transactions";
import { UsersService } from "../../../users/application/services/users.service";
import { AuthRepository } from "../ports/auth-repository";

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly config: IdentityConfig,
    private readonly users: UsersService,
    private readonly repository: AuthRepository,
    private readonly sessions: SessionsService,
  ) {}
  async execute(token: string) {
    const tokenDigest = this.config.crypto.secretDigest(token);
    const lookup = await this.repository.credential(this.db, tokenDigest);
    if (!lookup) throw new UnauthorizedException("INVALID_REFRESH");
    const result = await transaction(this.db, async (tx) => {
      await lockUsers(tx, [lookup.session.userId]);
      const credential = await this.repository.requiredCredential(
        tx,
        tokenDigest,
      );
      const family = credential.session;
      const user = await this.users.byId(tx, family.userId);
      if (
        credential.consumedAt ||
        credential.generation !== family.currentGeneration
      ) {
        await this.repository.revokeFamily(tx, family.id, "REPLAY");
        return null; // Commit family revocation before HTTP rejection.
      }
      if (
        !this.users.isActive(user) ||
        family.revokedAt ||
        family.securityVersion !== user.securityVersion ||
        family.absoluteExpiresAt <= new Date() ||
        credential.expiresAt <= new Date()
      )
        return null;
      await this.repository.consumeCredential(tx, credential.id);
      await this.repository.advanceGeneration(tx, family.id);
      return this.sessions.pair(
        tx,
        user,
        family.id,
        family.currentGeneration + 1,
        family.absoluteExpiresAt,
      );
    });
    if (!result) throw new UnauthorizedException("INVALID_REFRESH");
    return result;
  }
}
