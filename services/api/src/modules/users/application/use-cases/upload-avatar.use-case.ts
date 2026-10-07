import {
  BadRequestException,
  Injectable,
  UnsupportedMediaTypeException,
  PayloadTooLargeException,
} from "@nestjs/common";

import { createHash, randomUUID } from "node:crypto";

import { PrismaService } from "../../../../infrastructure/database/prisma.service";

import {
  lockUsers,
  transaction,
} from "../../../../shared/database/identity-transactions";
import { IdentityConfig } from "../../../../configs/identity.config";
import { AvatarRepository } from "../ports/avatar-repository";
import { AvatarStoragePort, AvatarInspector } from "../ports/avatar-providers";
import { AvatarInput } from "../contracts/avatar-input";
@Injectable()
export class UploadAvatarUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly repository: AvatarRepository,
    private readonly storage: AvatarStoragePort,
    private readonly inspector: AvatarInspector,
    private readonly config: IdentityConfig,
  ) {}
  async execute(userId: string, file: AvatarInput | undefined) {
    if (!file?.bytes.length) throw new BadRequestException("IMAGE_REQUIRED");
    if (file.size > 5 * 1024 * 1024)
      throw new PayloadTooLargeException("IMAGE_TOO_LARGE");
    const mime = await this.inspector.inspect(file.bytes);
    if (file.mime !== mime)
      throw new UnsupportedMediaTypeException("MIME_MISMATCH");
    const id = randomUUID();
    const storageKey = `avatars/${userId}/${id}`;
    await this.storage.put(storageKey, file.bytes, mime);
    try {
      await transaction(this.db, async (tx) => {
        await lockUsers(tx, [userId]);
        const user = await this.repository.requiredUser(tx, userId);
        if (user.accountStatus !== "ACTIVE")
          throw new BadRequestException("ACCOUNT_NOT_ACTIVE");
        await this.repository.create(tx, {
          id,
          userId,
          storageKey,
          mime,
          byteSize: BigInt(file.bytes.length),
          checksum: createHash("sha256").update(file.bytes).digest("hex"),
          expiresAt: new Date(
            Date.now() + this.config.avatarRetentionSeconds * 1000,
          ),
        });
      });
    } catch (error) {
      await this.storage.remove(storageKey).catch(() => undefined);
      throw error;
    }
    return { assetId: id, status: "QUARANTINED" };
  }
}
