# SH-005 validation

Date: 2026-10-05. Status: implemented and verified on PostgreSQL 17.11 (Docker
Compose, isolated database `skillhub_test`). Redis/BullMQ delivery and financial
consumers are still **Pending**, so SH-005 is not proven for payment flows.

## Implemented

- Request context: server-generated `requestId`, strict UUID `x-correlation-id`
  (anything else is replaced), IDs set on the response by the Pino `genReqId`
  hook and exposed to browsers through CORS `exposedHeaders`.
- `TransactionRunner.run`: explicit `TransactionContext`, Serializable by
  default, maxWait 2,000 ms / timeout 5,000 ms, at most 3 attempts with backoff,
  retry only for serialization failure (40001) and deadlock (40P01).
- `IdempotencyService.execute`: `INSERT ... ON CONFLICT DO NOTHING` claim,
  SHA-256 key digest and canonical command fingerprint, minimal result
  reference committed with the mutation; no raw request or response is stored.
- Outbox: `OutboxWriter.append(tx, event)`, `OutboxDispatcher` (batch 20,
  lease 30 s, publish timeout 10 s, 8 cycle attempts, `FOR UPDATE SKIP LOCKED`,
  lease-token CAS on ack/fail, `retryFailed`), `OutboxConsumer.processOnce`
  receipt for consumer-side dedup. Unknown event types are kept as failed.

## Checks run (API workspace, 2026-10-05)

| Check                                              | Result                         |
| -------------------------------------------------- | ------------------------------ |
| `pnpm build`, `tsc --noEmit`, `pnpm lint`          | Pass                           |
| `pnpm test:consistency` (no stores)                | Pass, 9/9                      |
| `pnpm test:consistency:integration` (PostgreSQL)   | Pass, 8/8                      |
| `prisma migrate deploy`, fresh database            | Pass, 5 migrations             |
| `prisma migrate deploy`, upgrade from the baseline | Pass                           |
| Real `AppModule` over HTTP with Compose stores     | Pass, readiness 200 (see note) |

What the integration suite proved on PostgreSQL:

- A failed callback rolls back the business write and the outbox row together.
- Write-skew conflict and a real deadlock are each retried in a fresh
  transaction and both writers commit (3 attempts for 2 transactions).
- Concurrent commands with one key execute once; the other call replays the
  stored reference. Failed work leaves no claim; a retried command with
  reordered keys replays; a different command gets 409; another scope never
  shares a result.
- Two dispatchers deliver 30 committed events exactly once. A row leased by a
  crashed dispatcher is not taken while the lease is live, is redelivered with
  the same `eventId` after expiry, and the consumer receipt keeps one side
  effect. An exhausted event stays failed with its error code; manual replay
  resets the cycle, increments `replayCount` and keeps `eventId`,
  `totalAttempts` and the last failure code.

Boot note: the real module graph started against PostgreSQL, MongoDB and Redis;
`/api/health/ready` returned 200, success and error responses carried
`x-request-id`, and a malformed `x-correlation-id` was replaced.

## Defects found by these checks and fixed

- **Conflicts were not retried.** adapter-pg 7.8.0 reports the SQLSTATE as
  `cause.originalCode`; it sets `cause.code` only for errors it does not map.
  Serialization failures arrived as shapes the classifier ignored, so the
  existing concurrent-idempotency test failed with 40001 on its first real run.
  `isRetryableDatabaseConflict` now reads the driver cause from both places
  Prisma puts it. Observed shapes, kept as a unit regression fixture in
  `test/transaction.test.mjs`:

  | Path                       | Shape                                                                                       |
  | -------------------------- | ------------------------------------------------------------------------------------------- |
  | Serialization, bare        | `DriverAdapterError`, `cause = { originalCode: "40001", kind: "TransactionWriteConflict" }` |
  | Serialization, model query | `P2034`, driver error under `meta.driverAdapterError`                                       |
  | Serialization, raw query   | `P2010`, driver error under `meta.driverAdapterError`                                       |
  | Deadlock, bare             | `DriverAdapterError`, `cause = { originalCode: "40P01", code: "40P01", kind: "postgres" }`  |
  | Deadlock, raw query        | `P2010`, driver error under `meta.driverAdapterError`                                       |

- **The API could not start.** `OutboxDispatcher` took
  `Pick<PrismaService, ...>` without an injection token. Fixed with
  `@Inject(PrismaService)`.

## Still pending

| Task | Pending evidence                                                                                |
| ---- | ----------------------------------------------------------------------------------------------- |
| 1    | Parallel HTTP requests with captured Pino output (IDs in log lines, not only in headers).       |
| 4    | A BullMQ consumer on Redis deduplicating by receipt; bounded shutdown with a publish in flight. |
| 5    | Separate migration and application database roles in a deployed environment.                    |
| —    | Financial consumers SH-055/060/063/067: nothing here proves payment or settlement idempotency.  |

## Running the integration suite

Use a database that only tests touch; the suite never reads `DATABASE_URL`.

```powershell
$env:TEST_DATABASE_URL = "postgresql://<user>:<password>@127.0.0.1:5433/skillhub_test"
$env:DATABASE_URL = $env:TEST_DATABASE_URL; pnpm db:deploy
pnpm test:consistency:integration
```

Tests create rows under random scopes/event types and delete only those rows.
They do not truncate or reset any table.

## Consumers

SH-003, SH-004 and SH-006 use `TransactionContext`, `RequestContext`,
`OutboxWriter` and the publisher registry from this feature.
