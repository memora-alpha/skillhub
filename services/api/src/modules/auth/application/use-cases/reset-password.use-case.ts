import { Injectable } from "@nestjs/common";

import { IdentityConfig } from "../../../../configs/identity.config";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  lockUsers,
  transaction,
} from "../../../../shared/database/identity-transactions";
import { UsersService } from "../../../users/application/services/users.service";
import { SessionsService } from "../services/sessions.service";
import { IdentityEmailIntentService } from "../../../notifications/application/services/identity-email-intent.service";
import { AuditService } from "../../../audit/application/audit.service";

import { normalizeEmail } from "../../../users/domain/profile-policy";
import { OtpService } from "../services/otp.service";

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly config: IdentityConfig,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly email: IdentityEmailIntentService,
    private readonly audit: AuditService,
    private readonly otp: OtpService,
  ) {}
  async execute(email: string, resetToken: string, password: string) {
    email = normalizeEmail(email);
    const hash = await this.config.crypto.hashPassword(password);
    await this.otp.verify(email, "PASSWORD_RESET_GRANT", resetToken, (proof) =>
      transaction(this.db, async (tx) => {
        const lookup = await this.users.byEmail(tx, email);
        if (!lookup) return false;
        await lockUsers(tx, [lookup.id]);
        const user = await this.users.byId(tx, lookup.id);
        if (
          !user ||
          !this.otp.resetEligible(user.accountStatus, user.emailVerified) ||
          user.id !== proof.userId ||
          user.securityVersion !== proof.securityVersion
        )
          return false;
        await this.users.password(tx, user.id, hash);
        await this.sessions.revoke(tx, user.id, "PASSWORD_RESET");
        await this.audit.append(tx, {
          actorId: user.id,
          action: "PASSWORD_RESET",
          targetType: "User",
          targetId: user.id,
        });

        return true;
      }),
    );
    const user = await this.users.byEmail(this.db, email);
    if (user)
      await this.email.intent({
        userId: user.id,
        email,
        kind: "PASSWORD_CHANGED",
        expiresAt: new Date(
          Date.now() + this.config.notificationSeconds * 1000,
        ),
        dedupeKey: `password-${user.id}-${user.securityVersion}`,
      });
  }
}
