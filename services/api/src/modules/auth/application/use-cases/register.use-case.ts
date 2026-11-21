import { ConflictException, Injectable } from "@nestjs/common";

import { IdentityConfig } from "../../../../configs/identity.config";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { UsersService } from "../../../users/application/services/users.service";
import {
  ContentModerationService,
  requireAllowed,
} from "../../../content-moderation/application/content-moderation.service";

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
    private readonly moderation: ContentModerationService,
  ) {}
  async execute(data: {
    email: string;
    fullName: string;
    password: string;
    timezone?: string;
    locale?: "vi" | "en";
  }) {
    data = { ...data, email: normalizeEmail(data.email) };
    if (await this.users.byEmail(this.db, data.email))
      throw new ConflictException("EMAIL_ALREADY_EXISTS");
    let fullNameModerationPolicy: string | undefined;
    const mode = this.moderation?.mode("profile") ?? "off";
    if (this.moderation) {
      const assessment = await this.moderation.evaluateText(
        "profile",
        "registration:1",
        [data.fullName],
      );
      requireAllowed(assessment);
      if (mode === "enforce")
        fullNameModerationPolicy = assessment.policyVersion;
    }
    const passwordHash = await this.config.crypto.hashPassword(data.password);
    await this.otp.requestRegistration(data.email, {
      fullName: data.fullName,
      passwordHash,
      timezone: data.timezone,
      locale: data.locale,
      ...(fullNameModerationPolicy ? { fullNameModerationPolicy } : {}),
    });
    return acknowledgment;
  }
}
