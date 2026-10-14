import "reflect-metadata";
import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../dist/infrastructure/database/prisma.service.js";
import { IdentityConfig } from "../dist/configs/identity.config.js";
import { UsersService } from "../dist/modules/users/application/services/users.service.js";
import { PrismaUsersRepository } from "../dist/modules/users/infrastructure/persistence/prisma-users-repository.js";
import { AuditService } from "../dist/modules/audit/application/audit.service.js";
import { PrismaAuditRepository } from "../dist/modules/audit/infrastructure/persistence/prisma-audit-repository.js";
import {
  createAdminAccount,
  adminAccountInputFromEnvironment,
  AdminAccountError,
} from "../dist/modules/users/application/create-admin-account.js";
import { seedIdentity } from "../dist/modules/users/application/bootstrap.js";
import { withReleaseLock } from "./release.mjs";

let db;
try {
  if (process.argv.length > 2)
    throw new AdminAccountError(
      "Run without arguments; configure BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in the environment.",
    );
  const input = adminAccountInputFromEnvironment(process.env);
  const env = new ConfigService(process.env);
  const config = new IdentityConfig(env);
  db = new PrismaService(env);
  await db.$connect();
  const usersRepository = new PrismaUsersRepository();
  const result = await withReleaseLock(process.env.DATABASE_URL, async () => {
    await seedIdentity(db, usersRepository);
    return createAdminAccount(
      db,
      new UsersService(usersRepository, config),
      new AuditService(new PrismaAuditRepository()),
      config,
      input,
    );
  });
  console.log(`Admin account created: ${result.userId} (ACTIVE, ADMIN).`);
} catch (error) {
  // Database/configuration errors can contain credentials. Only operator-safe errors are printed.
  console.error(
    error instanceof AdminAccountError
      ? error.message
      : "Admin creation failed. Check runtime configuration, applied migrations and database access.",
  );
  process.exitCode = 1;
} finally {
  await db?.$disconnect();
}
