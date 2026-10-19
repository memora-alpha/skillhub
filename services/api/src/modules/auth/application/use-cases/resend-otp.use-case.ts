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
    if (purpose === "REGISTER") {
      if (!(await this.users.byEmail(this.db, email)))
        await this.otp.requestRegistration(email);
      return acknowledgment;
    }
    const user = await transaction(this.db, async (tx) => {
      await lockEmail(tx, email);
      const lookup = await this.users.byEmail(tx, email);
      if (!lookup) return;
      await lockUsers(tx, [lookup.id]);
      const user = await this.users.byId(tx, lookup.id);
      if (
        !user ||
        !this.otp.resetEligible(user.accountStatus, user.emailVerified)
      )
        return;
      return user;
    });
    if (user) await this.otp.issueOtp(user, purpose);
    return acknowledgment;
  }
}
