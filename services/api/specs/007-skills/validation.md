# Skills implementation validation

## Per-skill level catalog validation — 2026-10-14

Branch: `feat/skill-level-catalog`. See [contract and rollout](skill-level-catalog.md).

| Check                                                         | Result                                                   |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| API lint                                                      | Passed, zero warnings                                    |
| API check-types                                               | Passed, Prisma generation and TypeScript                 |
| API build                                                     | Passed, Prisma generation and Nest compiler              |
| Runtime Prisma validation                                     | Passed                                                   |
| Skills PostgreSQL/HTTP/bootstrap                              | 38 passed; zero failures/skips                           |
| Affected policy, audit, RBAC, HTTP and projection regressions | 45 passed across sandbox and approved local-network runs |
| Learning Request FE input/schema regressions                  | 14 passed                                                |
| Learning Request PostgreSQL/HTTP integration                  | 7 passed                                                 |
| Formatting and git diff whitespace                            | Passed                                                   |

Skills command from services/api:

```powershell
node --test --test-reporter=spec --test-concurrency=1 test/skills/levels.test.mjs test/skills/migration.test.mjs test/skills/journeys.test.mjs test/skills/restore.test.mjs test/skills/files.test.mjs test/skills/http.test.mjs test/skills/bootstrap.test.mjs test/skills/tags.test.mjs test/skills/request-offerings.test.mjs
```

The level tests additionally reran with two independent Admin accounts for the
concurrent-edit scenario. That run included
`test/learning-requests/fe-extension.integration.test.mjs`: all 13 tests passed
(6 level tests already counted in Skills, plus 7 Learning Request tests).
The migration fixture inserts pre-upgrade active and archived Sharing Skills on
an archived Skill, then verifies their original IDs, enum codes, versions and
archive metadata survive with correct catalog references. Guarded HTTP verifies
new/default/legacy selection, same-skill FK, active-only choices, preserved old
selections, role/permission checks, malformed/null/unknown inputs, duplicate
code/normalized names, immutable codes, Swagger and success/error envelopes.
Concurrency, replay after permission revocation, stale versions and injected
audit failure verify atomic state/audit/idempotency behavior.

Affected regression command:

```powershell
node --test test/skills/policies.test.mjs test/skills/request-offerings-batch.test.mjs test/audit-policy.test.mjs test/audit-writer.test.mjs test/audit-http.test.mjs test/authorization.test.mjs test/authorization-http.test.mjs test/learning-requests/projection-http.test.mjs test/learning-requests/notification-repository.test.mjs
node --test test/learning-requests/fe-extension.test.mjs test/learning-requests/schema.test.mjs
```

The initial sandbox network attempts failed with EACCES to local PostgreSQL and
fetch failures to fixture HTTP; approved runs with local-network access passed.
The first upgrade fixture omitted required updated_at values; its seed was fixed
and the migration test passed. No unresolved failures remain. pg emits the existing
concurrent-query deprecation warning during some fixtures; it did not fail checks.

All PostgreSQL checks used randomized disposable schemas, removed after each run.
Application migrations and identity seed were **not** executed. Production rollout
must apply the new migration, deploy the new API, seed `skill-level:manage`, and
update web/mobile consumers to support dynamic level codes. No frontend files were
changed; no production deployment, provider validation or cloud analysis is claimed.

## Restore amendment validation

Dedicated restore commands are implemented for catalog and Sharing Skills; see [restore.md](restore.md). No schema migration or application-data seed was run for this change.

| Check                               | Result                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm --filter api lint`            | Passed, zero warnings                                                                         |
| `pnpm --filter api check-types`     | Passed, Prisma generation and TypeScript                                                      |
| `pnpm --filter api build`           | Passed, Prisma generation and Nest compiler                                                   |
| Skills PostgreSQL/HTTP/bootstrap    | 23 tests passed, zero skips/failures: restore, HTTP, bootstrap, journeys, migration and files |
| Affected audit/RBAC/Skills policies | 26 tests passed: audit policy/writer/HTTP, authorization policy/HTTP and Skills policies      |
| `git diff --check`                  | Passed                                                                                        |

The Skills run used `node --test --test-concurrency=1 test/skills/restore.test.mjs test/skills/http.test.mjs test/skills/bootstrap.test.mjs test/skills/journeys.test.mjs test/skills/migration.test.mjs test/skills/files.test.mjs` from services/api. Fixtures used real PostgreSQL disposable schemas and removed them afterward. Restore scenarios verify catalog ACTIVE/INACTIVE targets, live permission checks and replay denial after grant removal/restriction, ownership, expectedVersion, original ID/visibility/history, verified count, revoked evidence during archive, inactive/archived catalog rejection, duplicate current Sharing Skill, create-versus-restore and restore-versus-restore races, and audit-failure rollback of state/version/count/idempotency. HTTP tests verify 200 envelopes, missing authorization/key, invalid/null/unknown fields, required catalog status/reason and Swagger request/response declarations. Module bootstrap resolves the new Sharing Skills AuditModule dependency.

Initial sandbox runs could not reach PostgreSQL (`EACCES 127.0.0.1:5432`) or fixture HTTP listeners (`fetch failed`). Rerunning the affected network tests outside the sandbox passed. Policy/writer tests passed inside the sandbox. There are no unresolved restore test failures.

Constitution recheck: backend/module ownership, PostgreSQL atomicity, live authorization, contract validation and verification are Pass for this amendment. Delivery is not applicable: restore introduces no external call or new event/notification. UI and deployed application behavior were not exercised. During rollout, run the existing idempotent identity seed to add the two restore permissions/default grants. Earlier provider/staging release gates below remain separate from this restore evidence.

## Original Skills implementation

Date: 2026-10-07. Branch: `feat/skills`. Spec/plan committed as
`045403e docs(api): plan skills and evidence verification`. Implementation is a
working-tree change. No application database migration was deployed.

## Environment and results

Node 22.19.0, TypeScript 6.0.3, NestJS 11, Prisma 7.8.0. PostgreSQL integration
tests create random disposable schemas, including the runtime-v3 legacy schema,
and drop them in `finally`. Identity integration also uses real local Redis/BullMQ.
No production provider credentials or objects are included in fixtures.

| Check                | Evidence                                                                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API lint             | `pnpm --filter api lint` passed, zero warnings                                                                                                                                                           |
| Typecheck            | `pnpm --filter api check-types` passed, including Prisma generation                                                                                                                                      |
| Build                | `pnpm --filter api build` passed, including Prisma generation and Nest compiler                                                                                                                          |
| Regression           | 70 tests passed: identity policies/providers/Sonar regressions, RBAC/HTTP, audit/HTTP, transaction/idempotency/outbox, file policy/detection/storage/download/scan/reconciliation, and 3 Skills policies |
| Identity persistence | 17 tests passed on PostgreSQL/Redis, including concurrent signup/OTP/refresh/reset, role changes, worker recovery and HTTP contracts                                                                     |
| Runtime v3           | Migration preservation and 3 repository/profile/grant tests passed                                                                                                                                       |
| Foundation           | 6 configuration/error privacy/readiness tests passed                                                                                                                                                     |
| Skills integration   | 17 tests passed across migration, owner/reviewer journeys, HTTP/DTO/Swagger, file lifecycle and production feature module DI; see scripts and test files below                                           |
| Performance          | 10,000 Skill / 100,000 SharingSkill; 2 warmups and 30 measured service searches: p95 **60.5 ms**                                                                                                         |

The host initially exhausted memory during compilation. The final checked build
and typecheck passed with `NODE_OPTIONS=--max-old-space-size=2048 --max-semi-space-size=1`.
A temporary `tsc --noCheck` emission was used while diagnosing memory failures;
it is not the build/typecheck success reported above. Sandbox restrictions blocked
localhost sockets on the first regression attempt; the successful suites ran with
local network access. Failed attempts are not counted as passed results.

## Behavioral evidence

Runtime and catalog Prisma schemas validate successfully. `git diff --check` passed.

- Catalog: ADMIN grants, Staff denial, NFC/case/whitespace collision, literal LIKE
  escaping, idempotency same/different body, filter-bound cursors and inactive rules.
- Sharing Skill: ownership, duplicate active rows, immutable skill field via HTTP,
  invalid/null DTO fields, visibility/search/profile privacy, archive pending conflict
  and retained history.
- Evidence: 10,000,000-byte valid PDF accepted; +1 rejected even with configuration
  at 100 MB. QUARANTINED cannot submit, scan claim/CLEAN completion is required;
  durable storage binding supplies metadata. Owner and reviewer downloads work;
  another owner/locked reviewer is denied. Attached rejected evidence is retained;
  cleanup-versus-submit cannot claim an attached file.
- Review: batch approval/rejection, approved history retained on replacement,
  explicit revoke grant, final badge/counter recalculation, simultaneous reviewers
  have one winner, audit and outbox failures roll back business changes, replay
  checks live account/session/permission grant. Registered notification publishers
  and database consumer receipts deduplicate repeated delivery.
- Migration: fresh migration chain, legacy key backfill, collision IDs, active
  sharing uniqueness, description check, deferred empty-batch rejection.
- HTTP: actual Nest controllers, JWT/session guard, envelopes, pagination bounds,
  Swagger APPROVED mapping and evidence size serialized as a string. Feature module
  bootstrap uses real modules with fixture infrastructure/identity owner ports;
  it does not prove full deployment bootstrap.

Commands from workspace root:

```powershell
pnpm --filter api lint
pnpm --filter api check-types
pnpm --filter api build
pnpm --filter api test:skills
pnpm --filter api test:skills:integration
pnpm --filter api test:skills:performance
pnpm --filter api test:identity:integration
pnpm --filter api test:runtime-v3
```

Tests live in `test/skills/{policies,migration,journeys,files,http,bootstrap,performance}.test.mjs`.
The measured workload distributes 100,000 sharing rows across 10,000 skills and
10 active users, returning 10 sharers per selected skill. EXPLAIN used a bitmap
index scan on `sharing_skills_skill_id_idx`, 12 shared buffer hits and a 25 kB sort.
This is a local service measurement; traffic concurrency, network latency and skewed
production distributions still require staging validation.

## Pending release gates and handoff

T026 remains unchecked: S3/MinIO private bucket and **real ClamAV** end-to-end,
full deployment bootstrap/TLS, staging migration and operational recovery. The
Skills fixture uses in-memory object bytes and a controlled CLEAN scanner verdict;
provider adapter regressions use controlled local protocol servers. Neither is
a real storage/scanner E2E success claim. Existing foundation persistence scripts
requiring a separately migrated `TEST_DATABASE_URL`/least-privilege audit role are
not replaced by these feature tests; run them in staging/CI with their required
isolated databases. Feature tests directly exercise the changed transaction,
idempotency, audit and outbox behavior on real PostgreSQL.

Before deployment, review migration collision/preflight failures and legacy rows
against new description/reason/size constraints. Do not silently merge/archive them.
Unbound historical evidence remains inaccessible for new approval/download.
Run the existing idempotent identity seed to add feature grants. Signed URLs already
issued remain valid for their short TTL after a permission change.

UserLearnedSkill progression, Proposal/contact and anti-spam policy remain a
handoff to later features. Notification support here is only durable result records
with dedupe; inbox/preferences/email delivery are outside this feature.
