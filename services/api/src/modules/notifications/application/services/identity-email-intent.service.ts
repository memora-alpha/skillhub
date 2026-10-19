import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { IdentityConfig } from "../../../../configs/identity.config";
import { IdentityEmailKind } from "../../../../generated/prisma/client";
import { IdentityEmailJobs } from "../ports/identity-email-providers";

@Injectable()
export class IdentityEmailIntentService {
  constructor(
    private readonly config: IdentityConfig,
    private readonly jobs: IdentityEmailJobs,
  ) {}
  async intent(data: {
    userId: string;
    email: string;
    kind: IdentityEmailKind;
    code?: string;
    challengeId?: string;
    expiresAt: Date;
    dedupeKey: string;
  }) {
    const id = data.dedupeKey || randomUUID();
    await this.jobs.enqueue(id, 0, {
      keyId: this.config.keyId,
      encrypted: Buffer.from(
        this.config.crypto.encrypt(JSON.stringify(data), `${id}:email`),
      ).toString("base64"),
    });
  }
}
