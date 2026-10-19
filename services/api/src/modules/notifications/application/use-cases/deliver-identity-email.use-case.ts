import { Injectable } from "@nestjs/common";
import { IdentityEmailKind } from "../../../../generated/prisma/client";
import { IdentityConfig } from "../../../../configs/identity.config";
import {
  IdentityMailer,
  IdentityEmailPayload,
} from "../ports/identity-email-providers";
import { RedisService } from "../../../../infrastructure/cache/redis.service";
import { randomUUID } from "node:crypto";
import { OtpService } from "../../../auth/application/services/otp.service";

@Injectable()
export class DeliverIdentityEmailUseCase {
  constructor(
    private readonly config: IdentityConfig,
    private readonly smtp: IdentityMailer,
    private readonly otp: OtpService,
    private readonly redis: RedisService,
  ) {}
  async execute(id: string, payload: IdentityEmailPayload) {
    const crypto = this.config.cryptoFor(payload.keyId);
    if (!crypto) throw new Error("KEY_UNAVAILABLE");
    const data = JSON.parse(
      crypto.decrypt(Buffer.from(payload.encrypted, "base64"), `${id}:email`),
    ) as {
      email: string;
      kind: IdentityEmailKind;
      code?: string;
      challengeId?: string;
      expiresAt: string;
    };
    if (!Object.values(IdentityEmailKind).includes(data.kind))
      throw new Error("UNSUPPORTED_EMAIL_KIND");
    if (new Date(data.expiresAt).getTime() <= Date.now()) return;
    if (
      data.kind !== "PASSWORD_CHANGED" &&
      (!data.challengeId ||
        !(await this.otp.deliveryActive(
          data.email,
          data.kind === "REGISTER_OTP" ? "REGISTER" : "RESET_PASSWORD",
          data.challengeId,
        )))
    )
      return;
    const sentKey = `identity:email:sent:${id}`;
    const leaseKey = `identity:email:lease:${id}`;
    if (await this.redis.exists(sentKey)) return;
    const lease = randomUUID();
    if (!(await this.redis.set(leaseKey, lease, "EX", 60, "NX")))
      throw new Error("EMAIL_DELIVERY_BUSY");
    try {
      if (await this.redis.exists(sentKey)) return;
      await this.smtp.send(id, data.email, data.kind, data.code ?? null);
      await this.redis.set(
        sentKey,
        "1",
        "EX",
        this.config.deliveryRetentionSeconds,
      );
    } finally {
      await this.redis.eval(
        "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",
        1,
        leaseKey,
        lease,
      );
    }
  }
}
