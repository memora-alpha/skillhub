import { BadRequestException, Injectable } from "@nestjs/common";
import type { IdentityTx } from "../../../../shared/database/identity-transactions";

@Injectable()
export class StaffPermissionRepository {
  catalog(tx: IdentityTx, codes: readonly string[]) {
    return tx.permission.findMany({
      where: { code: { in: [...codes] } },
      select: { code: true, description: true },
      orderBy: { code: "asc" },
    });
  }
  target(tx: IdentityTx, id: string) {
    return tx.user.findUnique({
      where: { id },
      select: {
        staffPermissionVersion: true,
        roleIdRecord: { select: { code: true } },
      },
    });
  }
  list(tx: IdentityTx, userId: string) {
    return tx.userPermissionOverride.findMany({
      where: { userId },
      include: { permission: { select: { code: true } } },
      orderBy: { permissionId: "asc" },
    });
  }
  async change(
    tx: IdentityTx,
    userId: string,
    code: string,
    effect: string,
    actorId: string,
  ) {
    const permission = await tx.permission.findUnique({
      where: { code },
    });
    if (!permission) throw new BadRequestException("PERMISSION_NOT_INSTALLED");
    const key = { userId, permissionId: permission.id };
    if (effect === "RESET") {
      await tx.userPermissionOverride.deleteMany({ where: key });
    } else {
      await tx.userPermissionOverride.upsert({
        where: { userId_permissionId: key },
        create: { ...key, effect, updatedBy: actorId },
        update: { effect, updatedBy: actorId, updatedAt: new Date() },
      });
    }
    return tx.user.update({
      where: { id: userId },
      // Invalidates existing sessions, including long-lived event streams.
      data: {
        staffPermissionVersion: { increment: 1 },
        securityVersion: { increment: 1 },
      },
      select: { staffPermissionVersion: true },
    });
  }
}
