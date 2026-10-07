import { IdentityTx } from "../../../../shared/database/identity-transactions";
import {
  IdentityEmailDelivery,
  EmailDeliveryStatus,
  IdentityEmailKind,
} from "../../../../generated/prisma/client";
import { Injectable } from "@nestjs/common";
import { IdentityEmailRepository } from "../../application/ports/identity-email-repository";
@Injectable()
export class PrismaIdentityEmailRepository extends IdentityEmailRepository {
  create(
    tx: IdentityTx,
    data: {
      id: string;
      userId: string;
      challengeId?: string;
      kind: IdentityEmailKind;
      encryptedRecipient: Uint8Array<ArrayBuffer>;
      encryptedPayload?: Uint8Array<ArrayBuffer>;
      encryptionKeyId: string;
      expiresAt: Date;
      dedupeKey: string;
    },
  ): Promise<IdentityEmailDelivery> {
    return tx.identityEmailDelivery.create({ data });
  }
  recoverLeases(tx: IdentityTx): Promise<{ count: number }> {
    return tx.identityEmailDelivery.updateMany({
      where: { status: "LEASED", leaseUntil: { lte: new Date() } },
      data: { status: "PENDING", leaseUntil: null },
    });
  }
  expire(tx: IdentityTx): Promise<{ count: number }> {
    return tx.identityEmailDelivery.updateMany({
      where: {
        status: { in: ["PENDING", "LEASED"] },
        expiresAt: { lte: new Date() },
      },
      data: { status: "EXPIRED", encryptedPayload: null, leaseUntil: null },
    });
  }
  purgeTerminal(tx: IdentityTx, before: Date): Promise<{ count: number }> {
    return tx.identityEmailDelivery.deleteMany({
      where: {
        status: { in: ["SENT", "FAILED", "EXPIRED", "CANCELLED"] },
        createdAt: { lt: before },
      },
    });
  }
  due(tx: IdentityTx): Promise<IdentityEmailDelivery[]> {
    return tx.identityEmailDelivery.findMany({
      where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
      take: 100,
    });
  }
  lock(tx: IdentityTx, id: string): Promise<void> {
    return (async () => {
      await tx.$queryRaw`SELECT delivery_id FROM identity_email_deliveries WHERE delivery_id=${id}::uuid FOR UPDATE`;
    })();
  }
  find(tx: IdentityTx, id: string): Promise<IdentityEmailDelivery | null> {
    return tx.identityEmailDelivery.findUnique({ where: { id } });
  }
  finish(
    tx: IdentityTx,
    id: string,
    status: EmailDeliveryStatus,
    lastErrorCode?: string,
  ): Promise<IdentityEmailDelivery> {
    return tx.identityEmailDelivery.update({
      where: { id },
      data: {
        status,
        encryptedPayload: null,
        ...(lastErrorCode ? { lastErrorCode } : {}),
      },
    });
  }
  lease(
    tx: IdentityTx,
    id: string,
    leaseUntil: Date,
  ): Promise<IdentityEmailDelivery> {
    return tx.identityEmailDelivery.update({
      where: { id },
      data: { status: "LEASED", leaseUntil, attempts: { increment: 1 } },
    });
  }
  sent(
    tx: IdentityTx,
    id: string,
    leaseUntil: Date,
    messageId: string,
  ): Promise<{ count: number }> {
    return tx.identityEmailDelivery.updateMany({
      where: { id, status: "LEASED", leaseUntil },
      data: {
        status: "SENT",
        sentAt: new Date(),
        providerMessageId: messageId,
        encryptedPayload: null,
        leaseUntil: null,
      },
    });
  }
  failed(
    tx: IdentityTx,
    id: string,
    leaseUntil: Date,
    terminal: boolean,
    attempts: number,
  ): Promise<{ count: number }> {
    return tx.identityEmailDelivery.updateMany({
      where: { id, status: "LEASED", leaseUntil },
      data: {
        status: terminal ? "FAILED" : "PENDING",
        leaseUntil: null,
        lastErrorCode: "DELIVERY_FAILED",
        nextAttemptAt: new Date(Date.now() + 1000 * 2 ** attempts),
        ...(terminal ? { encryptedPayload: null } : {}),
      },
    });
  }
}
