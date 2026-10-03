import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  lockEmail,
  lockUsers,
  transaction,
} from "../../../../shared/database/identity-transactions";
import { UsersService } from "../../../users/application/services/users.service";

import { normalizeEmail } from "../../../users/domain/profile-policy";
import { OtpService } from "../services/otp.service";
import { acknowledgment } from "../contracts/acknowledgment";
@Injectable()
export class ResendOtpUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly users: UsersService,
    private readonly otp: OtpService,
  ) {}
  async execute(email: string, purpose: "REGISTER" | "RESET_PASSWORD") {
    email = normalizeEmail(email);
    await transaction(this.db, async (tx) => {
      await lockEmail(tx, email);
      const lookup = await this.users.byEmail(tx, email);
      if (!lookup) return;
      await lockUsers(tx, [lookup.id]);
      const user = await this.users.byId(tx, lookup.id);
      if (
        !user ||
        (purpose === "REGISTER"
          ? user.accountStatus !== "PENDING_VERIFICATION"
          : !this.otp.resetEligible(user.accountStatus, user.emailVerified))
      )
        return;
      await this.otp.issueOtp(tx, user.id, email, purpose, true);
    });
    return acknowledgment;
  }
}
