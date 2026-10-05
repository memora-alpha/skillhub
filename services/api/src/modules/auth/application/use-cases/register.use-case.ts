import { Injectable } from "@nestjs/common";

import { IdentityConfig } from "../../../../configs/identity.config";
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
export class RegisterUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly config: IdentityConfig,
    private readonly users: UsersService,
    private readonly otp: OtpService,
  ) {}
  async execute(data: {
    email: string;
    fullName: string;
    password: string;
    timezone?: string;
    locale?: "vi" | "en";
  }) {
    data = { ...data, email: normalizeEmail(data.email) };
    const passwordHash = await this.config.crypto.hashPassword(data.password);
    await transaction(this.db, async (tx) => {
      await lockEmail(tx, data.email);
      let user = await this.users.byEmail(tx, data.email);
      if (user) {
        await lockUsers(tx, [user.id]);
        user = await this.users.byId(tx, user.id);
        if (user?.accountStatus !== "PENDING_VERIFICATION") return;
      } else user = await this.users.create(tx, { ...data, passwordHash });
      await this.otp.issueOtp(
        tx,
        user.id,
        user.normalizedEmail,
        "REGISTER",
        false,
      );
    });
    return acknowledgment;
  }
}
