# Tasks: Admin Operations and API Hardening

**Input**: Design documents from `specs/017-admin-observability-hardening/`

**Tests**: Contract, HTTP, PostgreSQL integration, privacy and rate-limit tests are required.

## Phase 1: Setup

- [ ] T001 Add ADMIN-only `dashboard:read` and `learning-path:read:admin` catalog/seed entries in `src/shared/authorization/permission.catalog.ts` and `src/modules/users/infrastructure/persistence/prisma-users-repository.ts`
- [ ] T002 [P] Add date-window, timezone and work-item query DTOs in `src/modules/administration/presentation/http/admin-operations.dto.ts`
- [ ] T003 [P] Add response types and availability discriminators in `src/modules/administration/application/contracts/admin-operation.views.ts`

## Phase 2: Foundational readers

- [ ] T004 Define exported owner-reader ports for finance, reports, paths, verification and tag requests in their owning `src/modules/*/application/ports/` directories
- [ ] T005 Implement shared `[from,to)`/IANA local-day bucket policy in `src/modules/administration/domain/admin-reporting-window.ts`
- [ ] T006 Implement stable filter-bound cursor policy in `src/modules/administration/domain/admin-work-item-cursor.ts`
- [ ] T007 Add audit actions/projections for Admin detail reads in `src/modules/audit/domain/audit-action.catalog.ts`
- [ ] T008 Wire `AdministrationModule` reader dependencies without circular imports in `src/modules/administration/administration.module.ts`

## Phase 3: User Story 1 — Dashboard summary and trends (P1)

**Independent Test**: Boundary fixtures in two timezones reproduce the approved metric dictionary and isolate one failed section.

- [ ] T009 [P] [US1] Add metric policy unit tests in `test/admin-dashboard-policy.test.mjs`
- [ ] T010 [P] [US1] Add PostgreSQL aggregate fixtures/tests in `test/admin-dashboard.integration.test.mjs`
- [ ] T011 [US1] Implement user/learning/session aggregate readers in `src/modules/administration/application/services/admin-dashboard.reader.ts`
- [ ] T012 [US1] Compose authoritative Credit/fee/top-skill readers and availability handling in `src/modules/administration/application/services/admin-dashboard.reader.ts`
- [ ] T013 [US1] Implement summary/trends endpoints in `src/modules/administration/presentation/http/admin-operations.controller.ts`

## Phase 4: User Story 2 — Operational work queue (P1)

**Independent Test**: One item of every allowed kind is paginated/filterable without inferred severity and detail reads are audited.

- [ ] T014 [P] [US2] Add work-item normalization/cursor tests in `test/admin-work-items.test.mjs`
- [ ] T015 [P] [US2] Add mixed-source PostgreSQL tests in `test/admin-work-items.integration.test.mjs`
- [ ] T016 [US2] Implement allowlisted source adapters in `src/modules/administration/application/services/admin-work-items.reader.ts`
- [ ] T017 [US2] Implement deterministic merge, filters and cursor pagination in `src/modules/administration/application/services/admin-work-items.reader.ts`
- [ ] T018 [US2] Implement list/detail endpoints and minimal detail audit in `src/modules/administration/presentation/http/admin-operations.controller.ts`

## Phase 5: User Story 3 — Admin learning paths (P2)

**Independent Test**: Every lifecycle state returns a safe projection with no token, chat, evidence, email or storage key.

- [ ] T019 [P] [US3] Add projection privacy/permission HTTP tests in `test/admin-learning-paths.test.mjs`
- [ ] T020 [P] [US3] Add historical plan/session PostgreSQL tests in `test/admin-learning-paths.integration.test.mjs`
- [ ] T021 [US3] Implement bounded list/detail reader in `src/modules/administration/application/services/admin-learning-paths.reader.ts`
- [ ] T022 [US3] Implement list/detail endpoints and minimal detail audit in `src/modules/administration/presentation/http/admin-operations.controller.ts`

## Phase 6: User Story 4 — Proxy and rate-limit hardening (P2)

**Independent Test**: Direct/trusted-proxy spoof, shared-IP isolation, Redis failure and 429/CORS scenarios all pass.

- [ ] T023 [P] [US4] Add validated `TRUST_PROXY_HOPS` and device-HMAC configuration in `src/configs/identity.config.ts`
- [ ] T024 [P] [US4] Add limiter key/group policy unit tests in `test/identity/rate-limit-policy.test.mjs`
- [ ] T025 [P] [US4] Add proxy spoof and 429 HTTP tests in `test/identity/rate-limit-http.test.mjs`
- [ ] T026 [US4] Implement layered network/principal/session/device limiter keys in `src/shared/auth/request-rate-limit.policy.ts`
- [ ] T027 [US4] Integrate endpoint groups and privacy-safe logging in `src/shared/auth/identity-throttle.ts`
- [ ] T028 [US4] Add Retry-After/rate-limit headers and CORS exposure in `src/main.ts` and `src/shared/http/http-exception.filter.ts`

## Phase 7: QA and rollout

- [ ] T029 Add SH-120–125/127–128 automated/provider matrix and focused scripts in `test/backend-hardening/` and `package.json`
- [ ] T030 Run lint, typecheck, build, focused PostgreSQL suites and fresh Sonar analysis; record exact evidence in `specs/017-admin-observability-hardening/validation.md`

## Dependencies and delivery

- T001–T008 block all stories.
- US1 and US2 are the P1 MVP and may proceed after foundation; US3 and US4 can then run independently.
- T029–T030 close the feature after all selected stories.
- Within each story, tests are written before the corresponding implementation.

## Parallel opportunities

- T002/T003, T009/T010, T014/T015, T019/T020 and T023/T024/T025 touch separate files.
- After T008, US1 dashboard aggregates and US4 limiter policy can be implemented independently.
