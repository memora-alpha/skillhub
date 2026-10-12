# SonarCloud remediation

The original dev snapshot contains 339 open findings. After the user excluded web and mobile, 140 findings remain in scope: code changes for 53 findings, 77 proposed Accepted and 10 proposed False Positive dispositions. The 199 web/mobile findings are out of scope and their source changes have been discarded. Cloud dispositions and a new published analysis are still pending; this report does not declare the Quality Gate passed.

- Work branch: `fix/sonar-findings`, based on `547c7d7`.
- Published analysis used for the inventory: 12 October 2026, 16:30:47 (Asia/Saigon), revision `547c7d7bb8923da796763bd9d23c67e2f7d96d2a`.
- Scope: API, two documentation generators and root lint-staged shell quoting. The user subsequently excluded web and mobile; all 114 changed files in those workspaces were restored to HEAD.
- Complete inventory with issue keys, original lines, proposed resolutions and individual rationales: [findings.json](sonar-remediation/findings.json).
- Validation results and explicit limits: [validation.json](sonar-remediation/validation.json).
- [Published dev summary](https://sonarcloud.io/summary/new_code?id=memora-alpha_skillhub&branch=dev) and [open issues](https://sonarcloud.io/project/issues?id=memora-alpha_skillhub&issueStatuses=OPEN%2CCONFIRMED).

## Code changes

Retained API changes simplify optional access, validate errors explicitly, extract nested conditional expressions, add an explicit code-unit comparator that preserves existing attachment command digests (including mixed-case UUIDs), and use Unicode code points.

API validation, acceptance, schedule checks, settlement entry writes and report reconciliation have separate responsibilities with reduced complexity. Transaction order, wallet/ledger arithmetic, idempotency, live authorization and SSE backpressure remain in their existing sequence. No migration or database schema was rewritten. No public API contract or business policy was introduced.

Root hook shell quoting uses a raw replacement string and a separate intermediate value. The six existing commit-scope/quoting tests passed. Python generator changes discard unused tuple bindings and share the unchanged participation label; original model artifacts are untouched.

## Reviewed dispositions

These are proposals recorded in the branch, not changes already applied on SonarCloud. Every issue key is listed in the JSON inventory. Rules are not disabled and no NOSONAR comments or exclusions were added to production configuration.

| Count | Disposition, rule and file | Rationale |
| --- | --- | --- |
| 17 | Accepted — javascript:S9382 — services/api/scripts/check-local-connections-http.mjs | isolated smoke workflow needs chronological migrations, serial auth/throttle steps, timed readiness polling, delete-then-head validation and cursor-dependent Redis SCAN cleanup. |
| 4 | Accepted — plsql:S1192 — services/api/prisma/migrations/20261009010000_connections/migration.sql | immutable applied PostgreSQL DDL/check constraints and enum literals cannot use a shared procedural constant; rewriting migration history changes checksums without changing semantics. |
| 1 | False Positive — javascript:S2094 — services/api/scripts/check-local-connections-http.mjs | the empty class is a Nest module metadata target, decorated by Module immediately afterward; it provides isolated BullMQ registration to this smoke test. |
| 2 | False Positive — javascript:S4123 — services/api/scripts/check-local-connections-http.mjs | injected S3ObjectStorage.remove/head implement async ObjectStorage methods. Await is required before validating deletion and dropping the isolated schema. |
| 3 | Accepted — javascript:S9382 — services/api/scripts/check-local-connections.mjs | bounded sequential diagnostics drain each HTTP response and collect index results in deterministic order. |
| 1 | False Positive — jssecurity:S5145 — services/api/scripts/check-local-connections.mjs | the only sink serializes the entire object with JSON.stringify; input CR/LF, quotes and control characters are escaped as JSON string content. Pretty-print newlines are fixed serializer output. |
| 1 | Accepted — javascript:S9382 — services/api/scripts/initialize-local-mongo.mjs | poll primary election with delay and deadline; parallel attempts cannot replace time-ordered readiness checks. |
| 3 | Accepted — typescript:S9382 — services/api/src/infrastructure/storage/file-attachment.service.ts | lock sorted file IDs, validate each row, then bind; serial order is part of attach-versus-cleanup safety. |
| 4 | Accepted — typescript:S9382 — services/api/src/modules/application-events/application/application-events.service.ts | append/lock sorted recipient streams within one transaction; bounded retention cleanup limits load. |
| 3 | Accepted — typescript:S9382 — services/api/src/modules/application-events/presentation/events.controller.ts | ordered SSE delivery rechecks live access per event, advances cursor only in order and respects response backpressure. |
| 2 | Accepted — typescript:S9382 — services/api/src/modules/conversations/application/chat-publication.service.ts | commit a durable read intent before acknowledging it; serial recovery bounds load and preserves order. |
| 1 | False Positive — typescript:S7784 — services/api/src/modules/conversations/infrastructure/chat.repository.ts | JSON serialization deliberately normalizes optional undefined fields before the persisted draft digest. structuredClone preserves undefined and BSON types, changing the fingerprint contract. |
| 1 | Accepted — typescript:S9382 — services/api/src/modules/proposals/application/proposal-expiry.service.ts | bounded worker expires each candidate under its own lock/transaction and preserves retry behavior. |
| 3 | False Positive — plsql:VarcharUsageCheck — services/api/prisma/migrations/20261009000000_achievement_badges/migration.sql | this is PostgreSQL migration SQL; VARCHAR2 is an Oracle type and invalid for this database. |
| 12 | Accepted — typescript:S9382 — services/api/src/modules/credit/credit-ledger.service.ts | acquire sorted wallet locks and write balance/ledger/allocation entries serially on the same PostgreSQL transaction; parallelization risks lock order and financial snapshots. |
| 3 | Accepted — typescript:S9382 — services/api/src/modules/credit/seed-fee-policies.ts | reconcile each policy before creating its baseline; existing approved versions must win and operations share one transaction. |
| 1 | Accepted — typescript:S9382 — services/api/src/modules/learning-paths/learning-paths.service.ts | mark validated schedule versions LOCKED within the same finalization transaction. |
| 2 | Accepted — typescript:S9382 — services/api/src/modules/learning-sessions/learning-sessions.service.ts | update reputation then evaluate achievements for sorted participants in one completion transaction. |
| 2 | Accepted — typescript:S9382 — services/api/src/modules/reports/reports.service.ts | bind each evidence file before inserting its report-evidence reference within the same transaction. |
| 3 | Accepted — typescript:S9382 — services/api/src/modules/reputation/reputation.service.ts | reconcile and revoke an existing scoped restriction before inserting its replacement within one transaction. |
| 1 | Accepted — typescript:S9382 — services/api/src/modules/scheduling/scheduling.service.ts | update only changed sessions after all conflicts are validated, using the same transaction. |
| 1 | Accepted — typescript:S9382 — services/api/src/modules/learning-requests/application/use-cases/expire-learning-requests.use-case.ts | expire candidates individually with locked version revalidation and bounded database load. |
| 1 | Accepted — plsql:S1192 — services/api/prisma/migrations/20261007000000_runtime_v3/migration.sql | immutable applied PostgreSQL DDL/check constraints and enum literals cannot use a shared procedural constant; rewriting migration history changes checksums without changing semantics. |
| 7 | Accepted — plsql:S1192 — services/api/prisma/migrations/20261006000000_learning_requests/migration.sql | immutable applied PostgreSQL DDL/check constraints and enum literals cannot use a shared procedural constant; rewriting migration history changes checksums without changing semantics. |
| 1 | False Positive — plsql:VarcharUsageCheck — services/api/prisma/migrations/20261006000000_learning_requests/migration.sql | this is PostgreSQL migration SQL; VARCHAR2 is an Oracle type and invalid for this database. |
| 1 | Accepted — typescript:S9382 — services/api/src/infrastructure/storage/file-format-detector.ts | keep at most one file handle and inflater open at a time to bound hostile ZIP/OOXML resource use. |
| 1 | False Positive — typescript:S6671 — services/api/src/infrastructure/storage/unavailable-object-storage.adapter.ts | FileStorageError extends Nest HttpException, which extends Error. Rejecting it preserves the required HTTP status/code. |
| 2 | Accepted — typescript:S9382 — services/api/src/modules/system-configuration/application/seed-configuration.ts | insert missing baselines before revision reconciliation, preserving deterministic ordering on the transaction client. |
| 1 | Accepted — typescript:S9382 — services/api/src/modules/system-configuration/application/update-configuration.use-case.ts | apply audited changes serially; the pinned transaction driver forbids concurrent queries. |
| 2 | Accepted — plsql:S1192 — services/api/prisma/migrations/20261005030000_sh004_stored_files/migration.sql | immutable applied PostgreSQL DDL/check constraints and enum literals cannot use a shared procedural constant; rewriting migration history changes checksums without changing semantics. |

False Positive evidence includes a behavioral test proving FileStorageError is an Error with status 503 and a draft-digest test proving the existing JSON normalization contract. S3 adapter methods really return promises, despite inference from dynamically injected script providers. The diagnostic log uses JSON serialization, which escapes input CR/LF and control characters inside strings. PostgreSQL has VARCHAR rather than Oracle VARCHAR2.

## Verification

- API lint, TypeScript check and Nest build passed.
- API regression suite: 191 passed, zero failures/skips when run outside the network-restricted sandbox. The sandbox run initially failed localhost HTTP/SMTP/ClamAV adapter tests; the identical elevated suite passed all 191.
- Connections suite: 24 passed; its two real-store tests initially skipped without explicit TEST URLs. Both were then run separately against configured local PostgreSQL and a MongoDB replica set, using suite-owned random schema/database names: 2 passed, zero failures/skips.
- New settlement/serialization regression suite: 6 passed. Covers ONE_WAY payout, TWO_WAY return, conservation of ledger deltas, ordered wallet locks, replay without duplicate entries, invalid fee policy, attachment canonicalization, JSON normalization and storage Error semantics. Financial settlement checks use controlled repository fixtures; they are not live financial-store proof.
- After the final proposal event mapping change, proposal plus new regression tests passed 12/12.
- Local ESLint SonarJS 3.0.5 configured seven available rules with TypeScript project information before the frontend discard; the retained API/root changes were included and remain unchanged. Frontend verification results no longer apply to this branch. This subset is not a SonarCloud analysis and cannot establish the published Quality Gate or all analyzer-version behavior.
- Discard verification: git status and git diff show no remaining changes under apps/web or apps/mobile. The retained diff outside those workspaces was unchanged by the restore operation.
- Python generators parsed successfully; six root commit-scope/quoting tests and git diff whitespace checks passed.

## Constitution and remaining work

API principles 1–5, 7 and 8: Pass for this refactor; owner boundaries, stores, authorization, transaction order and durable delivery contracts are preserved. Principle 6: local checks and real Connections store tests passed; live financial-store verification was not added. There is no architectural exception or new product policy. The current scope retains API, documentation generators and root shell quoting; web/mobile changes were discarded at the user's request.

SonarCloud login through the existing GitHub session was rejected by automatic approval review because the request did not explicitly authorize that OAuth flow/account. No workaround was used and no cloud issue state changed. The user must authorize that login before the 87 in-scope proposed cloud dispositions can be applied. Then publish this branch only when authorized and require a fresh analysis to verify the 53 code changes. The project-wide gate may still be affected by the 199 excluded web/mobile findings. The user authorized a local remediation commit; no push was requested.
