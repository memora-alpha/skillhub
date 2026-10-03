import { Injectable } from "@nestjs/common";

import { randomUUID } from "node:crypto";
import { IdentityConfig } from "../../../../configs/identity.config";

import { IdentityTx } from "../../../../shared/database/identity-transactions";
import { IdentityEmailKind } from "../../../../generated/prisma/client";
import { IdentityEmailRepository } from "../ports/identity-email-repository";

@Injectable()
export class IdentityEmailIntentService {
  constructor(
    private readonly config: IdentityConfig,
    private readonly repository: IdentityEmailRepository,
  ) {}
  async intent(
    tx: IdentityTx,
    data: {
      userId: string;
      email: string;
      kind: IdentityEmailKind;
      code?: string;
      challengeId?: string;
      expiresAt: Date;
      dedupeKey: string;
    },
  ) {
    const id = randomUUID();
    return this.repository.create(tx, {
      id,
      userId: data.userId,
      challengeId: data.challengeId,
      kind: data.kind,
      encryptedRecipient: this.config.crypto.encrypt(
        data.email,
        `${id}:recipient`,
      ),
      encryptedPayload: data.code
        ? this.config.crypto.encrypt(data.code, `${id}:payload`)
        : undefined,
      encryptionKeyId: this.config.keyId,
      expiresAt: data.expiresAt,
      dedupeKey: data.dedupeKey,
    });
  }
}
