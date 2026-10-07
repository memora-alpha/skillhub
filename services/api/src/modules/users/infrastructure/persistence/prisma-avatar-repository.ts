import { IdentityTx } from "../../../../shared/database/identity-transactions";
import { AvatarAsset, User } from "../../../../generated/prisma/client";
import { ScanEvidence } from "../../application/contracts/avatar-input";
import { Injectable } from "@nestjs/common";
import { AvatarRepository } from "../../application/ports/avatar-repository";
@Injectable()
export class PrismaAvatarRepository extends AvatarRepository {
  requiredUser(tx: IdentityTx, id: string): Promise<User> {
    return tx.user.findUniqueOrThrow({ where: { id } });
  }
  create(
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
  ): Promise<AvatarAsset> {
    return tx.avatarAsset.create({ data: { ...data, state: "QUARANTINED" } });
  }
  find(tx: IdentityTx, id: string): Promise<AvatarAsset | null> {
    return tx.avatarAsset.findUnique({ where: { id } });
  }
  required(tx: IdentityTx, id: string): Promise<AvatarAsset> {
    return tx.avatarAsset.findUniqueOrThrow({ where: { id } });
  }
  select(tx: IdentityTx, userId: string, id: string | null): Promise<User> {
    return tx.user.update({
      where: { id: userId },
      data: { avatarAssetId: id },
    });
  }
  cancelUser(tx: IdentityTx, userId: string): Promise<{ count: number }> {
    return tx.avatarAsset.updateMany({
      where: { userId, state: { in: ["CLEAN", "QUARANTINED"] } },
      data: { state: "DELETED", expiresAt: new Date() },
    });
  }
  pending(tx: IdentityTx): Promise<AvatarAsset[]> {
    return tx.avatarAsset.findMany({
      where: { state: "QUARANTINED" },
      take: 100,
    });
  }
  unreferencedExpired(tx: IdentityTx): Promise<AvatarAsset[]> {
    return tx.avatarAsset.findMany({
      where: {
        state: { in: ["REJECTED", "DELETED", "CLEAN"] },
        expiresAt: { lte: new Date() },
        userSelectedAvatarRecords: { is: null },
      },
      take: 100,
    });
  }
  change(
    tx: IdentityTx,
    id: string,
    data: Partial<Pick<AvatarAsset, "state" | "expiresAt" | "checkedAt">> & {
      scanEvidence?: ScanEvidence;
    },
  ): Promise<AvatarAsset> {
    return tx.avatarAsset.update({ where: { id }, data });
  }
  latest(tx: IdentityTx, userId: string): Promise<AvatarAsset | null> {
    return tx.avatarAsset.findFirst({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }
  profile(tx: IdentityTx, userId: string): Promise<User> {
    return tx.user.findUniqueOrThrow({ where: { id: userId } });
  }
}
