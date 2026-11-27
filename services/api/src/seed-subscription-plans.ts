import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { seedSubscriptionPlans } from "./modules/subscriptions/application/seed-subscription-plans";
import { postgresConnectionString } from "./infrastructure/database/postgres-connection";

/** Dev/demo only: approved Creator and Pro plans (spec 021). Safe to rerun. */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: postgresConnectionString(connectionString),
    }),
  });
  try {
    const seeded = await prisma.$transaction((tx) => seedSubscriptionPlans(tx));
    process.stdout.write(
      seeded.length
        ? `Seeded subscription plans: ${seeded.map((plan) => plan.planCode).join(", ")}\n`
        : "Subscription plans already exist; nothing seeded\n",
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  // Never emit a provider exception: connection strings can contain credentials.
  const message =
    error instanceof Error && error.message.startsWith("subscription plan seed")
      ? error.message
      : "subscription plan seed failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
