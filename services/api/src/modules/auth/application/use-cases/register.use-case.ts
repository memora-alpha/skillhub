import { Injectable } from "@nestjs/common";

import { IdentityConfig } from "../../../../configs/identity.config";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
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
    if (!(await this.users.byEmail(this.db, data.email))) {
      await this.otp.requestRegistration(data.email, {
        fullName: data.fullName,
        passwordHash,
        timezone: data.timezone,
        locale: data.locale,
      });
    }
    return acknowledgment;
  }
}
