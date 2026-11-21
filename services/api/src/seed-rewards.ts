import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { postgresConnectionString } from "./infrastructure/database/postgres-connection";
import {
  assertRewardSeedAllowed,
  seedRewardCatalog,
} from "./modules/rewards/application/seed-rewards";

async function main(): Promise<void> {
  assertRewardSeedAllowed(process.env);
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: postgresConnectionString(connectionString),
    }),
  });
  try {
    const result = await seedRewardCatalog(prisma, {
      activate: process.argv.includes("--activate"),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  // Only our own refusal is safe to print: provider exceptions can carry connection strings.
  const refused =
    error instanceof Error && error.message.startsWith("REWARD_SEED_REFUSED");
  process.stderr.write(
    refused ? `${(error as Error).message}\n` : "reward seed failed\n",
  );
  process.exitCode = 1;
});
