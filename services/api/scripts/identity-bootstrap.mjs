import { PrismaUsersRepository } from "../dist/modules/users/infrastructure/persistence/prisma-users-repository.js";
import { PrismaAuditRepository } from "../dist/modules/audit/infrastructure/persistence/prisma-audit-repository.js";
import "reflect-metadata";
import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../dist/infrastructure/database/prisma.service.js";
import { IdentityConfig } from "../dist/configs/identity.config.js";
import { UsersService } from "../dist/modules/users/application/services/users.service.js";
import { AuditService } from "../dist/modules/audit/application/audit.service.js";
import {
  seedIdentity,
  bootstrapAdmin,
} from "../dist/modules/users/application/bootstrap.js";
const db = new PrismaService(new ConfigService(process.env));
try {
  await db.$connect();
  if (process.argv[2] === "seed")
    await seedIdentity(db, new PrismaUsersRepository());
  else if (process.argv[2] === "admin") {
    const [, , , userId, ...reason] = process.argv;
    if (!/^[0-9a-f-]{36}$/i.test(userId ?? ""))
      throw new Error("UUID required");
    const config = new IdentityConfig(new ConfigService(process.env));
    await bootstrapAdmin(
      db,
      new UsersService(new PrismaUsersRepository(), config),
      new AuditService(new PrismaAuditRepository()),
      userId,
      reason.join(" "),
    );
  } else throw new Error("Use seed or admin UUID reason");
  console.log("Identity operator action completed");
} catch {
  console.error(
    "Identity operator action failed. Check configuration, migration, UUID and reason.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
