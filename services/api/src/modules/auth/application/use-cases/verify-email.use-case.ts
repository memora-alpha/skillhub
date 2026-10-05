import { BadRequestException, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  lockUsers,
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
    const success = await transaction(this.db, async (tx) => {
      const lookup = await this.users.byEmail(tx, email);
      if (!lookup) return false;
      await lockUsers(tx, [lookup.id]);
      const user = await this.users.byId(tx, lookup.id);
      if (
        user?.accountStatus !== "PENDING_VERIFICATION" ||
        !(await this.otp.consume(tx, user.id, "REGISTER", code))
      )
        return false;
      await this.users.activate(tx, user.id);
      await this.audit.append(tx, {
        actorId: user.id,
        action: "EMAIL_VERIFIED",
        targetType: "User",
        targetId: user.id,
      });
      return true;
    });
    if (!success) throw new BadRequestException("OTP_INVALID_OR_EXPIRED");
  }
}
