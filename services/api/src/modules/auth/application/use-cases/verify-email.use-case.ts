import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";

import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  lockEmail,
  transaction,
} from "../../../../shared/database/identity-transactions";
import { UsersService } from "../../../users/application/services/users.service";

import { AuditService } from "../../../audit/application/services/audit.service";

import { normalizeEmail } from "../../../users/domain/profile-policy";
import { OtpService } from "../services/otp.service";
import {
  ContentModerationService,
  requireAllowed,
} from "../../../content-moderation/application/content-moderation.service";
import { moderationPolicyVersion } from "../../../content-moderation/domain/moderation-policy";

@Injectable()
export class VerifyEmailUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly otp: OtpService,
    private readonly moderation: ContentModerationService,
  ) {}
  async execute(email: string, code: string) {
    email = normalizeEmail(email);
    await this.otp.verify(email, "REGISTER", code, async (proof) => {
      const { fullNameModerationPolicy, ...draft } =
        this.otp.registration(proof);
      let requiresCheck =
        this.moderation?.mode("profile") === "enforce" &&
        fullNameModerationPolicy !== moderationPolicyVersion;
      if (requiresCheck && !(await this.users.byEmail(this.db, email))) {
        requireAllowed(
          await this.moderation.evaluateText("profile", proof.id, [
            draft.fullName,
          ]),
        );
        requiresCheck = false;
      }
      return transaction(this.db, async (tx) => {
        await lockEmail(tx, email);
        const existing = await this.users.byEmail(tx, email);
        // A committed create followed by Redis cleanup failure can be retried safely.
        if (existing)
          return (
            existing.id === proof.userId &&
            existing.emailVerified &&
            existing.accountStatus === "ACTIVE"
          );
        if (requiresCheck)
          throw new ServiceUnavailableException(
            "CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE",
          );
        if (this.moderation)
          requireAllowed(
            this.moderation.assessProfanity({
              surface: "profile",
              sourceVersion: proof.id,
              digest: createHash("sha256").update(draft.fullName).digest("hex"),
              text: draft.fullName,
            }),
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
      });
    });
  }
}
