import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { IdentityConfig } from "../../../../configs/identity.config";
import { IdentityEmailIntentService } from "../../../notifications/application/services/identity-email-intent.service";
import { OtpStore, OtpRecord, RegistrationDraft } from "../ports/otp-store";

export type OtpPurpose = "REGISTER" | "RESET_PASSWORD";
@Injectable()
export class OtpService {
  constructor(
    private readonly config: IdentityConfig,
    private readonly email: IdentityEmailIntentService,
    private readonly store: OtpStore,
  ) {}
  async requestRegistration(
    email: string,
    data?: {
      fullName: string;
      passwordHash: string;
      timezone?: string;
      locale?: "vi" | "en";
    },
  ): Promise<void> {
    const current = await this.store.read(email, "REGISTER");
    if (current && !current.registration) return; // Old pending-account proofs must expire.
    if (!current && !data) return;
    const userId = current?.userId ?? randomUUID();
    const draft = current
      ? this.registration(current)
      : {
          fullName: data!.fullName,
          passwordHash: data!.passwordHash,
          timezone: data!.timezone ?? this.config.timezone,
          locale: data!.locale,
          termsVersion: this.config.termsVersion,
          termsAcceptedAt: new Date().toISOString(),
        };
    await this.issueOtp(
      { id: userId, normalizedEmail: email, securityVersion: 0 },
      "REGISTER",
      draft,
      current?.id,
    );
  }
  registration(record: OtpRecord): RegistrationDraft {
    const crypto = this.config.cryptoFor(record.keyId);
    if (!record.registration || !crypto)
      throw new BadRequestException("OTP_INVALID_OR_EXPIRED");
    return JSON.parse(
      crypto.decrypt(
        Buffer.from(record.registration, "base64"),
        `${record.userId}:registration`,
      ),
    ) as RegistrationDraft;
  }
  async issueOtp(
    user: { id: string; normalizedEmail: string; securityVersion: number },
    purpose: OtpPurpose,
    registration?: RegistrationDraft,
    expectedId?: string,
  ) {
    const id = randomUUID();
    const code = this.config.crypto.otp();
    const expiresAt =
      Date.now() +
      (purpose === "REGISTER" ? 300 : this.config.resetSeconds) * 1000;
    const record: OtpRecord = {
      id,
      userId: user.id,
      securityVersion: user.securityVersion,
      keyId: this.config.keyId,
      digest: Buffer.from(
        this.config.crypto.otpDigest(id, purpose, code),
      ).toString("hex"),
      expiresAt,
      failedAttempts: 0,
      ...(registration
        ? {
            registration: Buffer.from(
              this.config.crypto.encrypt(
                JSON.stringify(registration),
                `${user.id}:registration`,
              ),
            ).toString("base64"),
          }
        : {}),
    };
    if (
      !(await this.store.issue(
        user.normalizedEmail,
        purpose,
        record,
        expectedId,
      ))
    )
      return;
    await this.email.intent({
      userId: user.id,
      email: user.normalizedEmail,
      code,
      challengeId: id,
      expiresAt: new Date(expiresAt),
      kind: purpose === "REGISTER" ? "REGISTER_OTP" : "RESET_OTP",
      dedupeKey: `otp-${id}`,
    });
  }
  async verify(
    email: string,
    purpose: OtpPurpose,
    code: string,
    work: (record: OtpRecord) => Promise<boolean>,
  ): Promise<void> {
    const row = await this.store.read(email, purpose);
    const crypto = row && this.config.cryptoFor(row.keyId);
    const lease = randomUUID();
    if (
      !row ||
      !crypto ||
      row.expiresAt <= Date.now() ||
      !(await this.store.claim(
        email,
        purpose,
        row.id,
        Buffer.from(crypto.otpDigest(row.id, purpose, code)).toString("hex"),
        lease,
      ))
    )
      throw new BadRequestException("OTP_INVALID_OR_EXPIRED");
    let committed = false;
    try {
      committed = await work(row);
      if (!committed) throw new BadRequestException("OTP_INVALID_OR_EXPIRED");
    } finally {
      await this.store.finish(email, purpose, row.id, lease, committed);
    }
  }
  resetEligible(status: string, verified: boolean) {
    return verified && ["ACTIVE", "LOCKED", "SUSPENDED"].includes(status);
  }
  async deliveryActive(
    email: string,
    purpose: OtpPurpose,
    id: string,
  ): Promise<boolean> {
    const row = await this.store.read(email, purpose);
    return (
      !!row &&
      row.id === id &&
      row.expiresAt > Date.now() &&
      row.failedAttempts < 5
    );
  }
}
