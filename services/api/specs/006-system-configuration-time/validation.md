# SH-006 validation

Date: 2026-10-05. Status: implemented and verified on PostgreSQL 17.11 (Docker
Compose, isolated database `skillhub_test`). Deployment TLS and human-actor
authorization are **Pending**.

## Implemented

- `Clock` / `CLOCK` / `ServerClock`; strict RFC 3339 instant parsing with
  calendar validation and IANA time-zone validation.
- Typed catalog: five fixed v1.4 policies plus two mutable storage policies
  (`storage.downloadTtlSeconds` 1–300, default 120; `storage.evidenceMaxBytes`,
  default 10,000,000 as approved 2026-10-05). No open policy (OP-01..05) is
  seeded; provider secrets are not catalog keys.
- `SystemConfigurationService.getSnapshot`: one query, typed values with
  versions, fails closed on missing, invalid or future-effective rows.
- `UpdateConfigurationUseCase`: whole-patch validation, mutable keys only,
  expected-version CAS, database `effectiveAt`, revision and audit per key in
  one transaction. Only `SYSTEM` actors are accepted until the users contract
  can recheck a human permission in-transaction; the use case is not exported
  and has no HTTP route.
- Seed inserts missing approved defaults with a baseline revision and never
  overwrites an existing value; an invalid fixed value stops with a
  reconciliation error.
- Environment: validated rate-limit integers wired into `ThrottlerModule`,
  storage/scanner variables required only when `STORAGE_ENABLED=true`,
  production checks for database/Mongo/Redis TLS parameters and HTTPS origins.
  Request logs drop the query string and redact credential headers.

## Deviations from the plan

- The seed entry point is `src/seed-configuration.ts`, run with
  `pnpm db:seed-configuration`, instead of `prisma/seed-configuration.ts` plus a
  Prisma seed command. It compiles with the app and needs no extra runner.
- `system-config:update` was not added to the permission catalog: there is no
  protected consumer yet, and the plan forbids granting it speculatively.

## Checks run (API workspace, 2026-10-05)

| Check                                                | Result      |
| ---------------------------------------------------- | ----------- |
| `pnpm build`, `tsc --noEmit`, `pnpm lint`            | Pass        |
| `pnpm test:configuration` (time, catalog, env, logs) | Pass, 18/18 |
| `pnpm test:configuration:integration` (PostgreSQL)   | Pass, 3/3   |
| Migration upgrade from the baseline, with backfill   | Pass        |

What ran on PostgreSQL:

- Seed on a fresh database, then a rerun after an update: the operator value
  and version are kept.
- An update commits the current row, revision (linked by `auditId`) and audit
  row together; two updates with one expected version commit exactly once and
  the loser gets a version conflict; a failure after the audit insert rolls
  back all three.
- Upgrade check on a throwaway database holding baseline rows: valid catalog
  rows (`storage.downloadTtlSeconds` = 90 at version 3,
  `credit.topUpVndPerCredit` = 1000) received a `MIGRATION` revision at their
  own version; a wrong fixed value and an unknown key were left untouched with
  no revision; DELETE on revisions was rejected by the trigger.

## Still pending

| Task | Pending evidence                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------- |
| 3    | Human actor with a current-permission recheck (needs SH-010/012). Snapshot versions stored by path/credit consumers. |
| 4    | Real TLS handshakes in a deployment environment. Validating URL parameters is not handshake evidence.                |
| 5    | NTP on hosts, shared throttle storage before running several instances, admin HTTP authorization.                    |

The integration test changes `storage.downloadTtlSeconds` in the test database.

## Handoff

- Auth (Huy): TTL/OTP/rate-limit values that are not approved stay out of the
  seed; add catalog keys with their spec.
- SH-004 reads `storage.evidenceMaxBytes` and `storage.downloadTtlSeconds`
  through `getSnapshot`.
- Scheduling/credit: take instants from `CLOCK`, never from the client, and
  store the configuration versions used for a decision.
