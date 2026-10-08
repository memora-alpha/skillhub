import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  lockEmail,
  transaction,
} from "../../../../shared/database/identity-transactions";
import { UsersService } from "../../../users/application/services/users.service";

import { AuditService } from "../../../audit/application/audit.service";

import { normalizeEmail } from "../../../users/domain/profile-policy";
import { OtpService } from "../services/otp.service";

@Injectable()
export class VerifyEmailUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly otp: OtpService,
  ) {}
  async execute(email: string, code: string) {
    email = normalizeEmail(email);
    await this.otp.verify(email, "REGISTER", code, (proof) =>
      transaction(this.db, async (tx) => {
        const draft = this.otp.registration(proof);
        await lockEmail(tx, email);
        const existing = await this.users.byEmail(tx, email);
        // A committed create followed by Redis cleanup failure can be retried safely.
        if (existing)
          return (
            existing.id === proof.userId &&
            existing.emailVerified &&
            existing.accountStatus === "ACTIVE"
          );
        const user = await this.users.create(tx, {
          ...draft,
          email,
          id: proof.userId,
          termsAcceptedAt: new Date(draft.termsAcceptedAt),
        });
        await this.users.activate(tx, user.id);
        await this.audit.append(tx, {
          actorId: user.id,
          action: "EMAIL_VERIFIED",
          targetType: "User",
          targetId: user.id,
        });
        return true;
      }),
    );
  }
}
