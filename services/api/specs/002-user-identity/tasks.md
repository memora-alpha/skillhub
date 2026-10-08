# Tasks: Danh tính người dùng

> Current OTP design: [Redis OTP amendment (2026-10-08)](redis-otp.md) supersedes PostgreSQL challenge/counter and email-outbox statements below.

Input: spec/plan/research/data-model/contracts/quickstart in this directory.
Paths below are relative to services/api. Tests are required by spec acceptance criteria and constitution. No feature-blocking checklist entries; production configuration choices remain explicit release gates.

## Phase 1 — Setup

- [x] T001 Add JWT, Argon2id, SMTP, S3, image inspection and HTTP testing dependencies in package.json/root lockfile.
- [x] T002 Generate reviewed identity-only migration and SQL constraints in prisma/migrations/20261003010000_identity/migration.sql; leave future catalog migrations deferred.
- [x] T003 Add strict identity configuration and safe env examples in src/configs/identity.config.ts and .env.example.

## Phase 2 — Foundation

- [x] T004 Write initial crypto/config/validation tests in test/identity/policies.test.mjs and confirm failure before implementation.
- [x] T005 Implement cryptography and input policies in src/modules/auth/domain/identity-crypto.ts and src/modules/users/domain/profile-policy.ts.
- [x] T006 Implement transaction/locking contracts in src/shared/database/identity-transactions.ts; private user/session adapters in owning modules' infrastructure/persistence.
- [x] T007 Add audit append, shared Redis throttling, live identity guard and versioned routing in src/modules/audit/application/audit.service.ts, src/shared/auth/identity.guard.ts and src/main.ts.
- [x] T008 Add idempotent role seeds/audited Admin bootstrap in src/modules/users/application/bootstrap.ts and scripts/identity-bootstrap.mjs.

## Phase 3 — US1 Register/verify/login (P1)

Independent test: controlled mailbox signup → one OTP consume → ACTIVE login, invalid/pending and concurrent signup/consume tests.

- [x] T009 [US1] Write real-storage signup/OTP contract tests in test/identity/integration.test.mjs for corresponding endpoints.
- [x] T010 [US1] Implement users account/profile application contracts in src/modules/users/application/services/users.service.ts and application/use-cases.
- [x] T011 [US1] Implement purpose-bound OTP issuance/limits/consume in src/modules/auth/application/services/otp.service.ts and Argon2 login in application/use-cases/login.use-case.ts.
- [x] T012 [US1] Implement encrypted transactional email intent/outbox in src/modules/notifications/application/services/identity-email-intent.service.ts, delivery/reconciliation use cases, infrastructure/jobs and src/infrastructure/email/smtp.adapter.ts.
- [x] T013 [US1] Add auth DTO/controllers and Swagger schemas in src/modules/auth/presentation/http/auth.dto.ts and auth.controller.ts.

## Phase 4 — US2 Session rotation/logout (P1)

Independent test: two login families; refresh/replay/current logout/all logout and concurrent reset/lock barriers.

- [x] T014 [US2] Add replay/concurrent refresh/revoke tests in test/identity/integration.test.mjs for session operations.
- [x] T015 [US2] Implement session issuance/revocation/current principal in src/modules/auth/application/services/sessions.service.ts and rotation in application/use-cases/refresh-token.use-case.ts.
- [x] T016 [US2] Wire refresh/logout/logout-all endpoints in src/modules/auth/presentation/http/auth.controller.ts.

## Phase 5 — US3 Password reset (P1)

Independent test: neutral forgot response; reset once preserves status, invalidates prior credentials and schedules notification.

- [x] T017 [US3] Add reset purpose/race/revocation tests in test/identity/integration.test.mjs for reset use cases.
- [x] T018 [US3] Implement forgot/reset with transactional password/version/revoke/audit/notification in src/modules/auth/application/use-cases/resend-otp.use-case.ts, reset-password.use-case.ts and presentation/http/auth.controller.ts.

## Phase 6 — US4 Profile/avatar (P2)

Independent test: own/public allowlist, invalid profile injection and scanned/quarantined uploads with previous-avatar preservation.

- [x] T019 [US4] Write projection/ownership/upload tests in test/identity/integration.test.mjs and policies.test.mjs.
- [x] T020 [US4] Add profile DTO/read/update/public endpoints in src/modules/users/presentation/http/users.controller.ts and users.dto.ts.
- [x] T021 [US4] Implement S3/quarantine/scan/cleanup adapters in src/infrastructure/storage/avatar-storage.ts and avatar-scanner.ts.
- [x] T022 [US4] Implement avatar lifecycle in src/modules/users/application/use-cases/_avatar_.use-case.ts, infrastructure/jobs and presentation/http/users.controller.ts.

## Phase 7 — US5 Permission management (P2)

Independent test: USER/STAFF/Admin permission matrix; lock/revoke/unlock, bound one-use reauth and audit rollback.

- [x] T023 [US5] Write management/reauth/audit transaction tests in test/identity/integration.test.mjs.
- [x] T024 [US5] Implement masked cursor listing, lock/unlock, STAFF grant/revoke via owning contracts in src/modules/users/application/use-cases and shared moderation/role services.
- [x] T025 [US5] Implement one-use action-bound reauth in src/modules/auth/application/services/reauth-proof.service.ts, application/use-cases/reauthenticate.use-case.ts and management routes in src/modules/users/presentation/http/administration.controller.ts.

## Phase 8 — Validation and operations

- [x] T026 Wire identity module, credential redaction and health VERSION_NEUTRAL in src/modules/identity.module.ts, src/app.module.ts and src/health.controller.ts.
- [x] T027 Verify lint/schema/typecheck/build/policies/foundation tests and versioned Swagger/HTTP in package.json, test/identity and specs/002-user-identity/validation.md.
- [x] T028 Run real PostgreSQL/Redis concurrency, outbox/restart and avatar provider failure tests with disposable isolated storage in test/identity/integration.test.mjs.
- [x] T029 Update README, plan/constitution evidence, tasks and quickstart with actual implementation/config/runtime limitations.

## Dependencies and execution

Setup → Foundation → US1 → US2 → US3 → US4 → US5 → Validation. Shared contracts are built before endpoint stories. Initial policy tests preceded crypto implementation; behavioral tests expanded alongside use cases; no test completion is inferred from schema/typecheck alone. Different crypto/profile policy files can be developed independently; after core auth/session contracts, avatar adapters and administration DTOs are independent file work. Run all storage-mutating tests against unique disposable schemas/keys, never existing user data. Identity migration includes only this feature's models despite the full product schema catalog.

Strategy: achieve verified signup/login first, then session security/recovery, then profile/upload/management. All five stories are required for feature completion. No hook registered for before/after tasks or implementation; no further commit/push is implied by implementation.

## Phase 9 — Architecture refactor after Memora source review

- [x] T030 Move private persistence into owning module repositories; replace administrative Prisma filters with a business query and retain explicit shared transaction context.
- [x] T031 Extract identity and profile/avatar/administration use cases; retain cohesive OTP/session/reauth/audit contracts and map transport inputs at the HTTP boundary.
- [x] T032 Move BullMQ processors and reconciliation lifecycle into infrastructure; inject storage/scanner/email/queue ports into application workflows.
- [x] T033 Verify unchanged HTTP/Swagger contracts, transaction rollback, concurrency, failed-proof counters, replay revocation and durable recovery with real-storage tests; compile the runtime application provider graph and exercise both worker/queue adapters.
- [x] T034 Update plan, README, quickstart and validation with actual architecture and check results.

## Phase 10 — Memora response standard

- [x] T035 Apply shared success/paginated/failure helpers at the HTTP boundary, preserving status codes, neutral acknowledgments, safe errors and bodiless 204 responses.
- [x] T036 Align Swagger schemas, HTTP contract, plan, README and quickstart with `data` and `meta.pagination`.
- [x] T037 Verify real HTTP envelopes, cursor continuity, projection safety, no-store and 204 bodies alongside lint/typecheck/build and all existing identity checks; record results in validation.md.

## Completion evidence

All 37 tasks completed, including the architecture refactor and Memora response amendment verified on 2026-10-04. See validation.md: 24 use cases with owner-private persistence, application ports, infrastructure workers/schedulers, passing lint/typecheck/build and 27 Node test entries. Real PostgreSQL/Redis/BullMQ checks cover concurrency, rollback, versioned HTTP envelopes/pagination and both email/avatar worker adapters. Production configuration/provider acceptance remains a release gate; no application-schema migration deployment was performed. The implementation/refactor was committed separately; the user requested a response amendment commit and pull request into dev on 2026-10-04.

## Registration after proof amendment — 2026-10-08

- [x] Stage encrypted registration draft/hash in Redis without a User row.
- [x] Create verified ACTIVE User/USER assignment/audit only after valid OTP.
- [x] Preserve drafts across duplicate signup/resend and consume after commit.
- [x] Cover concurrent verification, rollback, expiry and cleanup-failure retries.
- [x] Update Swagger lifecycle, HTTP contract and current design documentation.
