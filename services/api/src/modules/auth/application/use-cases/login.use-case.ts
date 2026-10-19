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
import { SessionsService } from "../services/sessions.service";

import { normalizeEmail } from "../../../users/domain/profile-policy";

@Injectable()
export class LoginUseCase {
  private dummyHash?: Promise<string>;
  constructor(
    private readonly db: PrismaService,
    private readonly config: IdentityConfig,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
  ) {}
  async execute(email: string, password: string, rememberMe = false) {
    email = normalizeEmail(email);
    const lookup = await this.users.byEmail(this.db, email);
    this.dummyHash ??= this.config.crypto.hashPassword(
      this.config.crypto.secret(),
    );
    const hash = lookup?.passwordHash ?? (await this.dummyHash);
    const valid = await this.config.crypto.verifyPassword(hash, password);
    if (!lookup) throw new UnauthorizedException("INVALID_CREDENTIALS");
    const result = await transaction(this.db, async (tx) => {
      await lockUsers(tx, [lookup.id]);
      const user = await this.users.byId(tx, lookup.id);
      if (!user || !valid || user.passwordHash !== hash) {
        if (user) await this.users.loginFailure(tx, user.id);
        return { error: "credentials" } as const;
      }
      if (!this.users.isActive(user)) return { error: "status" } as const;
      await this.users.loginSuccess(tx, user.id);
      return { pair: await this.sessions.issue(tx, user, rememberMe) } as const;
    });
    if ("error" in result) {
      if (result.error === "status")
        throw new ForbiddenException("ACCOUNT_NOT_ACTIVE");
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    }
    return result.pair;
  }
}
