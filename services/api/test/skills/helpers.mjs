import "reflect-metadata";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "../../dist/generated/prisma/client.js";
import { IdentityConfig } from "../../dist/configs/identity.config.js";
import { createIdentityFixture } from "../identity/fixture.mjs";
import { PrismaUsersRepository } from "../../dist/modules/users/infrastructure/persistence/prisma-users-repository.js";
import { TransactionRunner } from "../../dist/infrastructure/database/transaction-runner.js";
import { IdempotencyService } from "../../dist/infrastructure/idempotency/idempotency.service.js";
import { AuditRepository } from "../../dist/modules/audit/infrastructure/audit.repository.js";
import { AuditWriter } from "../../dist/modules/audit/application/audit-writer.js";
import { OutboxWriter } from "../../dist/infrastructure/events/outbox-writer.js";
import { OutboxConsumer } from "../../dist/infrastructure/events/outbox-consumer.js";
import { OutboxPublisherRegistry } from "../../dist/infrastructure/events/outbox.types.js";
import { SkillActorService } from "../../dist/modules/users/application/services/skill-actor.service.js";
import { PublicSkillReader } from "../../dist/modules/users/application/services/public-skill-reader.js";
import { ProfileReader } from "../../dist/modules/users/application/services/profile-reader.service.js";
import { SkillsRepository } from "../../dist/modules/skills/infrastructure/skills.repository.js";
import { SkillsService } from "../../dist/modules/skills/application/skills.service.js";
import { SkillLevelsService } from "../../dist/modules/skills/application/skill-levels.service.js";
import { SharingSkillsRepository } from "../../dist/modules/sharing-skills/infrastructure/sharing-skills.repository.js";
import { SharingSkillsService } from "../../dist/modules/sharing-skills/application/sharing-skills.service.js";
import { VerificationsRepository } from "../../dist/modules/verifications/infrastructure/verifications.repository.js";
import { VerificationsService } from "../../dist/modules/verifications/application/verifications.service.js";
import { FileAttachmentService } from "../../dist/infrastructure/storage/file-attachment.service.js";
import { PrismaStoredFileRepository } from "../../dist/infrastructure/storage/prisma-stored-file.repository.js";
import { FileStorageService } from "../../dist/infrastructure/storage/file-storage.service.js";
import { SkillNotificationHandler } from "../../dist/modules/notifications/application/skill-notification.handler.js";

export async function createSkillFixture(
  beforeSkillsMigration,
  beforeLevelMigration,
  beforeTagMigration,
) {
  const schema = `skills_test_${randomUUID().replaceAll("-", "")}`;
  if (!/^skills_test_[a-f0-9]{32}$/.test(schema))
    throw new Error("Invalid test schema");
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL or DATABASE_URL required");
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  const db = new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString: url,
        connectionTimeoutMillis: 5000,
        options: `-c search_path=${schema}`,
      },
      { schema },
    ),
  });
  let identity;
  const dispose = async () => {
    await identity?.module.close();
    await db.$disconnect();
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.query(`DROP SCHEMA IF EXISTS "${schema}_legacy_v3" CASCADE`);
    await client.end();
  };
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    const migrations = new URL("../../prisma/migrations/", import.meta.url);
    // Migrations and the pre-Skills hook must finish in chronological order.
    for (const name of (await readdir(migrations))
      .filter((n) => n.startsWith("2026"))
      .sort((left, right) => left.localeCompare(right))) {
      if (name === "20261007010000_skills")
        await beforeSkillsMigration?.(client);
      if (name === "20261014000000_skill_level_catalog")
        await beforeLevelMigration?.(client);
      if (name === "20261015000000_tag_creation_requests")
        await beforeTagMigration?.(client);
      await client.query(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      );
    }
    await db.$connect();
    const usersRepository = new PrismaUsersRepository();
    await db.$transaction((tx) => usersRepository.seedRoles(tx));
    const config = new IdentityConfig(new ConfigService(process.env));
    identity = await createIdentityFixture({
      db,
      config,
      storage: { url: async () => null },
      scanner: { scan: async () => "CLEAN" },
      smtp: { send: async () => {} },
      queue: { add: async () => {} },
    });
    const transactions = new TransactionRunner(db),
      commands = new IdempotencyService(transactions),
      audit = new AuditWriter(new AuditRepository()),
      outbox = new OutboxWriter();
    const actors = new SkillActorService(identity.sessions),
      publicReader = new PublicSkillReader();
    const profiles = new ProfileReader(
      db,
      usersRepository,
      { url: async () => null },
      publicReader,
    );
    const skills = new SkillsService(
      new SkillsRepository(db),
      actors,
      commands,
      transactions,
      audit,
    );
    const levels = new SkillLevelsService(
      db,
      new SkillsRepository(db),
      actors,
      transactions,
      commands,
      audit,
    );
    const sharing = new SharingSkillsService(
      new SharingSkillsRepository(db),
      skills,
      actors,
      commands,
      transactions,
      profiles,
      publicReader,
      audit,
    );
    sharing.onModuleInit();
    const stored = new PrismaStoredFileRepository(db, transactions, outbox),
      attachments = new FileAttachmentService(db);
    const objects = new Map();
    const objectStorage = {
      put: async (key, body) => {
        const chunks = [];
        for await (const b of body) chunks.push(b);
        objects.set(key, Buffer.concat(chunks));
      },
      head: async (key) =>
        objects.has(key) ? { size: objects.get(key).length } : null,
      read: async (key) =>
        (await import("node:stream")).Readable.from(objects.get(key)),
      remove: async (key) => objects.delete(key),
      signGet: async (key) => `https://fixture.invalid/private?key=${key}`,
    };
    const storage = new FileStorageService(stored, objectStorage, {
      getSnapshot: async (keys) => ({
        values: Object.fromEntries(
          keys.map((key) => [
            key,
            key === "storage.downloadTtlSeconds" ? 120 : 100_000_000,
          ]),
        ),
      }),
    });
    const verifications = new VerificationsService(
      new VerificationsRepository(db),
      sharing,
      actors,
      commands,
      transactions,
      storage,
      attachments,
      audit,
      outbox,
    );
    const registry = new OutboxPublisherRegistry(),
      consumer = new OutboxConsumer(transactions),
      notifications = new SkillNotificationHandler(
        registry,
        consumer,
        verifications,
      );
    notifications.onModuleInit();
    async function account(role = "USER") {
      const id = randomUUID();
      const user = await db.$transaction(async (tx) => {
        const user = await identity.users.create(tx, {
          email: `${id}@fixture.invalid`,
          fullName: "Skill Fixture User",
          // Test placeholder only; these accounts authenticate through issued session tokens.
          passwordHash: "fixture-hash",
        });
        await identity.users.activate(tx, user.id);
        if (role !== "USER")
          await identity.users.role(tx, user.id, role, true, null);
        return tx.user.findUniqueOrThrow({ where: { id: user.id } });
      });
      const token = await db.$transaction((tx) =>
        identity.sessions.issue(tx, user, false),
      );
      const principal = await identity.sessions.principal(token.accessToken);
      return { user, principal, token: token.accessToken };
    }
    const command = (account, key = randomUUID()) => ({
      principal: account.principal,
      key,
      context: { requestId: randomUUID(), correlationId: randomUUID() },
    });
    async function readyFile(account, options = {}) {
      return db.storedFile.create({
        data: {
          id: randomUUID(),
          purpose: "EVIDENCE",
          uploadedBy: account.user.id,
          objectKey: `fixture/${randomUUID()}`,
          originalName: "evidence.pdf",
          detectedMime: "application/pdf",
          sizeBytes: 1024,
          sha256: "a".repeat(64),
          state: "READY",
          scanVerdict: "CLEAN",
          scannerVersion: "fixture",
          scannedAt: new Date(),
          ...options,
        },
      });
    }
    return {
      schema,
      client,
      db,
      identity,
      actors,
      transactions,
      commands,
      audit,
      outbox,
      skills,
      sharing,
      levels,
      profiles,
      verifications,
      attachments,
      stored,
      storage,
      objectStorage,
      objects,
      registry,
      consumer,
      notifications,
      account,
      command,
      readyFile,
      dispose,
    };
  } catch (error) {
    await dispose();
    throw error;
  }
}
