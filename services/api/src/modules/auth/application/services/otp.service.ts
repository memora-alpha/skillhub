import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { IdentityConfig } from "../../../../configs/identity.config";

import { IdentityTx } from "../../../../shared/database/identity-transactions";

import { IdentityEmailIntentService } from "../../../notifications/application/services/identity-email-intent.service";

import { AuthRepository } from "../ports/auth-repository";
import { OtpPurpose } from "../../../../generated/prisma/client";

@Injectable()
export class OtpService {
  constructor(
    private readonly config: IdentityConfig,
    private readonly email: IdentityEmailIntentService,
    private readonly repository: AuthRepository,
  ) {}
  async issueOtp(
    tx: IdentityTx,
    userId: string,
    email: string,
    purpose: OtpPurpose,
    resend: boolean,
  ) {
    const now = new Date();
    const windowStart = new Date(Math.floor(now.getTime() / 3600000) * 3600000);
    const latest = await this.repository.latestIssue(tx, email, purpose);
    const window = await this.repository.issueWindow(
      tx,
      email,
      purpose,
      windowStart,
    );
    if (
      (latest && now.getTime() - latest.lastIssuedAt.getTime() < 60000) ||
      (window && window.issueCount >= 5)
    )
      return;
    await this.repository.recordIssue(
      tx,
      email,
      purpose,
      windowStart,
      now,
      resend,
    );
    await this.repository.supersedeChallenges(tx, userId, purpose, now);
    const id = randomUUID();
    const code = this.config.crypto.otp();
    const expiresAt = new Date(
      now.getTime() +
        (purpose === "REGISTER" ? 300 : this.config.resetSeconds) * 1000,
    );
    await this.repository.createChallenge(tx, {
      id,
      userId,
      email,
      purpose,
      expiresAt,
      verifierKeyId: this.config.keyId,
      verifierDigest: this.config.crypto.otpDigest(id, purpose, code),
    });
    await this.email.intent(tx, {
      userId,
      email,
      code,
      challengeId: id,
      expiresAt,
      kind: purpose === "REGISTER" ? "REGISTER_OTP" : "RESET_OTP",
      dedupeKey: `otp:${id}`,
    });
  }
  async consume(
    tx: IdentityTx,
    userId: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<boolean> {
    const row = await this.repository.activeChallenge(tx, userId, purpose);
    if (
      !row ||
      row.expiresAt <= new Date() ||
      row.failedAttempts >= 5 ||
      !this.config.cryptoFor(row.verifierKeyId)
    )
      return false;
    if (
      !this.config
        .cryptoFor(row.verifierKeyId)!
        .matches(
          row.verifierDigest,
          this.config
            .cryptoFor(row.verifierKeyId)!
            .otpDigest(row.id, purpose, code),
        )
    ) {
      await this.repository.failChallenge(tx, row.id);
      return false; // Failed attempt persists; never throw inside this transaction.
    }
    await this.repository.consumeChallenge(tx, row.id);
    return true;
  }
  resetEligible(status: string, verified: boolean) {
    return verified && ["ACTIVE", "LOCKED", "SUSPENDED"].includes(status);
  }
  deliveryChallenge(tx: IdentityTx, id: string) {
    return this.repository.challengeById(tx, id);
  }
}
