import { IdentityTx } from "../../../../shared/database/identity-transactions";
import { AvatarAsset, User } from "../../../../generated/prisma/client";
import { ScanEvidence } from "../../application/contracts/avatar-input";
export abstract class AvatarRepository {
  abstract requiredUser(tx: IdentityTx, id: string): Promise<User>;
  abstract create(
    tx: IdentityTx,
    data: Pick<
      AvatarAsset,
      | "id"
      | "userId"
      | "storageKey"
      | "mime"
      | "byteSize"
      | "expiresAt"
      | "checksum"
    >,
  ): Promise<AvatarAsset>;
  abstract find(tx: IdentityTx, id: string): Promise<AvatarAsset | null>;
  abstract required(tx: IdentityTx, id: string): Promise<AvatarAsset>;
  abstract select(
    tx: IdentityTx,
    userId: string,
    id: string | null,
  ): Promise<User>;
  abstract cancelUser(
    tx: IdentityTx,
    userId: string,
  ): Promise<{ count: number }>;
  abstract pending(tx: IdentityTx): Promise<AvatarAsset[]>;
  abstract unreferencedExpired(tx: IdentityTx): Promise<AvatarAsset[]>;
  abstract change(
    tx: IdentityTx,
    id: string,
    data: Partial<Pick<AvatarAsset, "state" | "expiresAt" | "checkedAt">> & {
      scanEvidence?: ScanEvidence;
    },
  ): Promise<AvatarAsset>;
  abstract latest(tx: IdentityTx, userId: string): Promise<AvatarAsset | null>;
  abstract profile(tx: IdentityTx, userId: string): Promise<User>;
}
