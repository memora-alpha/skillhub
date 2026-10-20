import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { TransactionRunner } from "../dist/infrastructure/database/transaction-runner.js";
import { OutboxWriter } from "../dist/infrastructure/events/outbox-writer.js";
import { IdempotencyService } from "../dist/infrastructure/idempotency/idempotency.service.js";
import { AuditWriter } from "../dist/modules/audit/application/services/audit-writer.js";
import { AuditRepository } from "../dist/modules/audit/infrastructure/persistence/audit.repository.js";
import { skip, withDatabase } from "./integration-db.mjs";

// Fixture use case only: stands in for a credit adjustment until the credit module exists.
test(
  "idempotent sensitive command: failed attempt leaves nothing, replay adds no second audit",
  { skip },
  () =>
    withDatabase(async (prisma) => {
      const idempotency = new IdempotencyService(new TransactionRunner(prisma));
      const audit = new AuditWriter(new AuditRepository());
      const outbox = new OutboxWriter();
      const scope = `test:${randomUUID()}`;
      const type = "test.audit-transaction";
      const context = { requestId: randomUUID(), correlationId: randomUUID() };
      const walletId = randomUUID();
      const input = {
        scope,
        operation: "credit-adjust:v1",
        key: randomUUID(),
        command: { walletId, amount: "5" },
      };
      let commitFails = true;
      // Convention under test: mutation -> audit append -> result, all in the caller's transaction.
      const work = async (tx) => {
        const eventId = randomUUID();
        await outbox.append(tx, {
          eventId,
          type,
          version: 1,
          payload: { walletId },
          correlationId: context.correlationId,
        });
        await audit.append(tx, {
          actor: { kind: "SYSTEM", name: "foundation-test" },
          action: "CREDIT_ADJUST",
          target: { type: "CREDIT_WALLET", id: walletId },
          after: { amount: "5" },
          reason: "Integration adjustment",
          context,
        });
        if (commitFails) throw new Error("failed before commit");
        return { id: eventId, status: "ADJUSTED" };
      };
      const counts = async () => ({
        audits: await prisma.auditLog.count({
          where: { correlationId: context.correlationId },
        }),
        events: await prisma.outboxEvent.count({
          where: { correlationId: context.correlationId },
        }),
        claims: await prisma.idempotencyRecord.count({ where: { scope } }),
      });
      try {
        await assert.rejects(
          idempotency.execute(input, work),
          /failed before commit/,
        );
        assert.deepEqual(await counts(), { audits: 0, events: 0, claims: 0 });

        commitFails = false;
        const first = await idempotency.execute(input, work);
        const replay = await idempotency.execute(input, work);
        assert.deepEqual(replay, { value: first.value, replayed: true });
        assert.deepEqual(await counts(), { audits: 1, events: 1, claims: 1 });

        await assert.rejects(
          idempotency.execute(
            { ...input, command: { walletId, amount: "6" } },
            work,
          ),
          /different command/,
        );
        assert.deepEqual(await counts(), { audits: 1, events: 1, claims: 1 });
      } finally {
        // audit_logs is append-only by design; its fixture row stays in the test database.
        await prisma.outboxEvent.deleteMany({
          where: { type, correlationId: context.correlationId },
        });
        await prisma.idempotencyRecord.deleteMany({ where: { scope } });
      }
    }),
);
