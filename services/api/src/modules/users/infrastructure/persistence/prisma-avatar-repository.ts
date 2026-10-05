import { IdentityTx } from "../../../../shared/database/identity-transactions";
import {
  AvatarAsset,
  User,
  Profile,
} from "../../../../generated/prisma/client";
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
      "id" | "userId" | "storageKey" | "mime" | "byteSize" | "expiresAt"
    >,
  ): Promise<AvatarAsset> {
    return tx.avatarAsset.create({ data });
  }
  find(tx: IdentityTx, id: string): Promise<AvatarAsset | null> {
    return tx.avatarAsset.findUnique({ where: { id } });
  }
  required(tx: IdentityTx, id: string): Promise<AvatarAsset> {
    return tx.avatarAsset.findUniqueOrThrow({ where: { id } });
  }
  select(tx: IdentityTx, userId: string, id: string | null): Promise<Profile> {
    return tx.profile.update({
      where: { userId },
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
        selectedProfiles: { none: {} },
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
  profile(tx: IdentityTx, userId: string): Promise<Profile> {
    return tx.profile.findUniqueOrThrow({ where: { userId } });
  }
}
