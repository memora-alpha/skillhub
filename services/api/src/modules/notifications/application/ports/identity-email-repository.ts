import { IdentityTx } from "../../../../shared/database/identity-transactions";
import {
  IdentityEmailDelivery,
  EmailDeliveryStatus,
  IdentityEmailKind,
} from "../../../../generated/prisma/client";
export abstract class IdentityEmailRepository {
  abstract create(
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
  ): Promise<IdentityEmailDelivery>;
  abstract recoverLeases(tx: IdentityTx): Promise<{ count: number }>;
  abstract expire(tx: IdentityTx): Promise<{ count: number }>;
  abstract purgeTerminal(
    tx: IdentityTx,
    before: Date,
  ): Promise<{ count: number }>;
  abstract due(tx: IdentityTx): Promise<IdentityEmailDelivery[]>;
  abstract lock(tx: IdentityTx, id: string): Promise<void>;
  abstract find(
    tx: IdentityTx,
    id: string,
  ): Promise<IdentityEmailDelivery | null>;
  abstract finish(
    tx: IdentityTx,
    id: string,
    status: EmailDeliveryStatus,
    lastErrorCode?: string,
  ): Promise<IdentityEmailDelivery>;
  abstract lease(
    tx: IdentityTx,
    id: string,
    leaseUntil: Date,
  ): Promise<IdentityEmailDelivery>;
  abstract sent(
    tx: IdentityTx,
    id: string,
    leaseUntil: Date,
    messageId: string,
  ): Promise<{ count: number }>;
  abstract failed(
    tx: IdentityTx,
    id: string,
    leaseUntil: Date,
    terminal: boolean,
    attempts: number,
  ): Promise<{ count: number }>;
}
