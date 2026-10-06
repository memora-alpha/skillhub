import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // Keep the implemented identity client/migrations separate from the v3 catalog.
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
