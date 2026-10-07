# Skills implementation validation

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
