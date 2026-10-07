import { Injectable } from "@nestjs/common";
import { IdentityEmailKind } from "../../../../generated/prisma/client";

import { IdentityConfig } from "../../../../configs/identity.config";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";

import { transaction } from "../../../../shared/database/identity-transactions";

import { IdentityEmailRepository } from "../ports/identity-email-repository";
import { IdentityMailer } from "../ports/identity-email-providers";
import { OtpService } from "../../../auth/application/services/otp.service";
@Injectable()
export class DeliverIdentityEmailUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly config: IdentityConfig,
    private readonly repository: IdentityEmailRepository,
    private readonly smtp: IdentityMailer,
    private readonly otp: OtpService,
  ) {}
  async execute(id: string) {
    const leaseUntil = new Date(Date.now() + 60000);
    const row = await transaction(this.db, async (tx) => {
      await this.repository.lock(tx, id);
      const found = await this.repository.find(tx, id);
      if (
        found?.status !== "PENDING" ||
        (found.nextAttemptAt && found.nextAttemptAt > new Date())
      )
        return null;
      if (
        !(Object.values(IdentityEmailKind) as readonly string[]).includes(
          found.kind,
        )
      ) {
        await this.repository.finish(
          tx,
          id,
          "FAILED",
          "UNSUPPORTED_EMAIL_KIND",
        );
        return null;
      }
      if (found.attempts >= this.config.deliveryAttempts) {
        await this.repository.finish(tx, id, "FAILED", "RETRY_EXHAUSTED");
        return null;
      }
      const challenge = found.challengeId
        ? await this.otp.deliveryChallenge(tx, found.challengeId)
        : null;
      const stale =
        challenge &&
        (challenge.consumedAt ||
          challenge.supersededAt ||
          challenge.expiresAt <= new Date() ||
          challenge.failedAttempts >= 5);
      if (found.expiresAt <= new Date() || stale) {
        await this.repository.finish(tx, id, stale ? "CANCELLED" : "EXPIRED");
        return null;
      }
      return this.repository.lease(tx, id, leaseUntil);
    });
    if (!row) return;
    try {
      const crypto = this.config.cryptoFor(row.encryptionKeyId);
      if (!crypto) throw new Error("KEY_UNAVAILABLE");
      const recipient = crypto.decrypt(
        row.encryptedRecipient,
        `${id}:recipient`,
      );
      const code = row.encryptedPayload
        ? crypto.decrypt(row.encryptedPayload, `${id}:payload`)
        : null;
      const messageId = await this.smtp.send(
        id,
        recipient,
        row.kind as IdentityEmailKind,
        code,
      );
      await this.repository.sent(this.db, id, leaseUntil, messageId);
    } catch {
      const terminal =
        row.attempts >= this.config.deliveryAttempts ||
        row.expiresAt <= new Date();
      await this.repository.failed(
        this.db,
        id,
        leaseUntil,
        terminal,
        row.attempts,
      );
    }
  }
}
