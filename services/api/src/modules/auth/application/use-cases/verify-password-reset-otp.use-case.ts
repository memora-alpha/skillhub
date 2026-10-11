import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  lockUsers,
  transaction,
} from "../../../../shared/database/identity-transactions";
import { UsersService } from "../../../users/application/services/users.service";
import { normalizeEmail } from "../../../users/domain/profile-policy";
import { OtpService } from "../services/otp.service";

@Injectable()
export class VerifyPasswordResetOtpUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly users: UsersService,
    private readonly otp: OtpService,
  ) {}
  async execute(email: string, code: string) {
    email = normalizeEmail(email);
    return this.otp.verifyResetOtp(email, code, (proof) =>
      transaction(this.db, async (tx) => {
        await lockUsers(tx, [proof.userId]);
        const user = await this.users.byId(tx, proof.userId);
        return (
          !!user &&
          user.normalizedEmail === email &&
          this.otp.resetEligible(user.accountStatus, user.emailVerified) &&
          user.securityVersion === proof.securityVersion
        );
      }),
    );
  }
}
