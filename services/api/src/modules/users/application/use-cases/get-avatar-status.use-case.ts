import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../../../infrastructure/database/prisma.service";

import { AvatarRepository } from "../ports/avatar-repository";

@Injectable()
export class GetAvatarStatusUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly repository: AvatarRepository,
  ) {}
  async execute(userId: string, id: string) {
    const row = await this.repository.find(this.db, id);
    if (!row || row.userId !== userId) throw new NotFoundException();
    return { assetId: id, status: row.state };
  }
}
