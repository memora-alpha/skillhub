import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../dist/generated/prisma/client.js";

export const skip =
  !process.env.TEST_DATABASE_URL &&
  "Set TEST_DATABASE_URL to a migrated isolated PostgreSQL database";

/** Runs work against the isolated test database only; never falls back to DATABASE_URL. */
export async function withDatabase(work) {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }),
  });
  await prisma.$connect();
  try {
    return await work(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
