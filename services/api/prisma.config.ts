import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // Full v3 runtime, including the technical OTP/foundation models.
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
