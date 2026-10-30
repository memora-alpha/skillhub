import "reflect-metadata";
import "dotenv/config";
import mongoose from "mongoose";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../dist/infrastructure/database/prisma.service.js";
import { backfillChatActivity } from "./lib/chat-activity-backfill.mjs";

let db;
try {
  if (!process.env.MONGODB_URI || !process.env.DATABASE_URL)
    throw new Error("MISSING_CONFIGURATION");
  db = new PrismaService(new ConfigService(process.env));
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false,
    serverSelectionTimeoutMS: 5000,
  });
  console.log(
    JSON.stringify(await backfillChatActivity(db, mongoose.connection.db)),
  );
} catch {
  console.error(
    "Chat activity backfill failed. Check database access, Mongo availability and the mobile list ordering migration; rerun safely after fixing the cause.",
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
  await db?.$disconnect();
}
