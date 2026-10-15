import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { seedApprovedConfigurations } from "./modules/system-configuration/application/seed-configuration";
import { ConfigurationRepository } from "./modules/system-configuration/infrastructure/configuration.repository";
import { seedPathFeePolicies } from "./modules/credit/application/seed-fee-policies";
import { seedAchievements } from "./modules/reputation/seed-achievements";
import { postgresConnectionString } from "./infrastructure/database/postgres-connection";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: postgresConnectionString(connectionString),
    }),
  });
  try {
    const repository = new ConfigurationRepository(prisma);
    await prisma.$transaction(async (tx) => {
      await seedApprovedConfigurations(tx, repository);
      await seedPathFeePolicies(tx);
      await seedAchievements(tx);
    });
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  // Never emit a provider exception: connection strings can contain credentials.
  process.stderr.write("configuration seed failed\n");
  process.exitCode = 1;
});
