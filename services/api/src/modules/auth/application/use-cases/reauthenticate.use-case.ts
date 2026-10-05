import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import { IdentityConfig } from "../../../../configs/identity.config";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  lockUsers,
  transaction,
} from "../../../../shared/database/identity-transactions";
import { UsersService } from "../../../users/application/services/users.service";
import { SessionsService, Principal } from "../services/sessions.service";

import { AuthRepository } from "../ports/auth-repository";

@Injectable()
export class ReauthenticateUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly config: IdentityConfig,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly repository: AuthRepository,
  ) {}
  async execute(principal: Principal, password: string) {
    const lookup = await this.users.byId(this.db, principal.userId);
    const valid =
      !!lookup?.passwordHash &&
      (await this.config.crypto.verifyPassword(lookup.passwordHash, password));
    if (!valid) throw new UnauthorizedException("INVALID_CREDENTIALS");
    return transaction(this.db, async (tx) => {
      await lockUsers(tx, [principal.userId]);
      const live = await this.sessions.assertLive(tx, principal);
      if (!live.roles.includes("ADMIN")) throw new ForbiddenException();
      const user = await this.users.byId(tx, principal.userId);
      if (user?.passwordHash !== lookup?.passwordHash)
        throw new UnauthorizedException();
      const token = this.config.crypto.secret();
      const expiresAt = new Date(Date.now() + this.config.reauthSeconds * 1000);
      await this.repository.createProof(tx, {
        userId: live.userId,
        sessionId: live.sessionId,
        securityVersion: live.securityVersion,
        purpose: "STAFF_ROLE_CHANGE",
        digest: this.config.crypto.secretDigest(token),
        expiresAt,
      });
      return { reauthToken: token, expiresAt: expiresAt.toISOString() };
    });
  }
}
