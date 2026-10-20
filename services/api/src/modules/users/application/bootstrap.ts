import { UsersRepository } from "./ports/users-repository";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import {
  lockUsers,
  transaction,
} from "../../../shared/database/identity-transactions";
import { UsersService } from "./services/users.service";
import { AuditService } from "../../audit/application/services/audit.service";

export async function seedIdentity(
  db: PrismaService,
  repository: UsersRepository,
) {
  await transaction(db, (tx) => repository.seedRoles(tx));
}
export async function bootstrapAdmin(
  db: PrismaService,
  users: UsersService,
  audit: AuditService,
  userId: string,
  reason: string,
) {
  if (!reason.trim() || reason.length > 1000)
    throw new Error("Nonblank operator reason required");
  await transaction(db, async (tx) => {
    await lockUsers(tx, [userId]);
    const user = await users.byId(tx, userId);
    if (!users.isActive(user))
      throw new Error("Existing verified ACTIVE user required");
    const changed = await users.role(tx, userId, "ADMIN", true, null);
    await audit.append(tx, {
      action: "ADMIN_BOOTSTRAP",
      targetType: "User",
      targetId: userId,
      reason,
      after: { changed },
    });
  });
}
