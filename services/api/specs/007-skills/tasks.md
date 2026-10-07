# Tasks: Kỹ năng

Input: [plan.md](plan.md), [spec.md](spec.md), research/data-model/contracts/quickstart. Paths relative to services/api. Tests required by plan; no frontend work.

## Phase 1: Setup

- [x] T001 Verify ignore/config files and existing integration source in `.gitignore`, `eslint.config.mjs`, `src/modules/identity.module.ts`.
- [x] T002 Prepare behavioral test harness and scripts in `test/skills/helpers.mjs`, `package.json`.

## Phase 2: Foundational

- [x] T003 Add runtime fields and additive SQL constraints/preflight in `scripts/generate-runtime-schema.mjs`, `prisma/migrations/20261007010000_skills/migration.sql`.
- [x] T004 Add users-owned live permission/counter contracts and role seeds in `src/modules/users/application/services/skill-actor.service.ts`, `src/modules/users/infrastructure/persistence/prisma-users-repository.ts`.
- [x] T005 Add validators/cursor/badge behavior and tests in `src/modules/skills/domain/skill-policy.ts`, `test/skills/policies.test.mjs`.
- [x] T006 Verify migration fresh/upgrade/constraints in `test/skills/migration.test.mjs`.

## Phase 3: US5 Catalog (prerequisite catalog for US1)

Independent test: authorized catalog create/update/archive, normalized collision and historical preservation.

- [x] T007 [US5] Implement catalog owner service/repository in `src/modules/skills/application/skills.service.ts`, `src/modules/skills/infrastructure/skills.repository.ts`.
- [x] T008 [US5] Implement catalog HTTP/DTO/module with audit and idempotency in `src/modules/skills/presentation/http/skills.controller.ts`, `src/modules/skills/skills.module.ts`.
- [x] T009 [US5] Verify catalog authorization/concurrency/normalization in `test/skills/journeys.test.mjs`.

## Phase 4: US1 Sharing Skill

Independent test: owner adds/edits/hides/archives; duplicate active and wrong ownership rejected.

- [x] T010 [US1] Implement sharing owner repository/service/eligibility in `src/modules/sharing-skills/infrastructure/sharing-skills.repository.ts`, `src/modules/sharing-skills/application/sharing-skills.service.ts`.
- [x] T011 [US1] Implement owner HTTP/DTO/module in `src/modules/sharing-skills/presentation/http/sharing-skills.controller.ts`, `src/modules/sharing-skills/sharing-skills.module.ts`.
- [x] T012 [US1] Verify ownership/archive/duplicate/immutable skill in `test/skills/journeys.test.mjs`.

## Phase 5: US2 Search and public profile

Independent test: public projection/search returns visible active accounts, no evidence/email/reject reason.

- [x] T013 [US2] Implement search and profile reader port integration in `src/modules/sharing-skills/application/sharing-skills.service.ts`, `src/modules/users/application/services/profile-reader.service.ts`.
- [x] T014 [US2] Verify pagination/filters/privacy in `test/skills/journeys.test.mjs` and benchmark in `test/skills/performance.test.mjs`.

## Phase 6: US3 Submit evidence

Independent test: upload/scan/submit1–5 own READY files; pending batch preserves prior approval.

- [x] T015 [US3] Add storage status/binding/10 MB ceiling/orphan recovery in `src/infrastructure/storage/file-storage.service.ts`, `src/infrastructure/storage/file-reconciler.ts`, `src/infrastructure/storage/prisma-stored-file.repository.ts`.
- [x] T016 [US3] Implement verification owner repository and submit/history/file policies in `src/modules/verifications/infrastructure/verifications.repository.ts`, `src/modules/verifications/application/verifications.service.ts`.
- [x] T017 [US3] Implement upload/status/submit/history/download HTTP in `src/modules/verifications/presentation/http/verifications.controller.ts`.
- [x] T018 [US3] Verify storage/scan transitions, ownership, byte limits and cleanup race in `test/skills/files.test.mjs`.

## Phase 7: US4 Reviewer decisions

Independent test: permissioned reviewer decision atomic, one winner; revoke changes badge only when no valid approval remains.

- [x] T019 [US4] Implement queue/approve/reject/revoke with aggregate/count/audit/outbox in `src/modules/verifications/application/verifications.service.ts`.
- [x] T020 [US4] Implement Staff controllers/module in `src/modules/verifications/presentation/http/staff-verifications.controller.ts`, `src/modules/verifications/verifications.module.ts`.
- [x] T021 [US4] Add registered/deduped result notification delivery in `src/modules/notifications/application/skill-notification.handler.ts`, `src/modules/notifications/skill-notification.module.ts`.
- [x] T022 [US4] Verify decisions/replay/rollback/grant revocation/outbox recovery in `test/skills/journeys.test.mjs`.

## Phase 8: Polish and integration

- [x] T023 Wire composition and OpenAPI contracts in `src/app.module.ts`, controllers/DTO files; verify HTTP/bootstrap with `test/skills/http.test.mjs` and `test/skills/bootstrap.test.mjs`.
- [x] T024 Run focused/static/regression/integration/performance checks and record evidence in `specs/007-skills/validation.md`.
- [x] T025 Update implementation docs/status/handoff in `README.md`, `prisma/README.md`, `specs/007-skills/quickstart.md`, `specs/007-skills/plan.md`.

## Dependencies and parallel opportunities

T001→T002→T003..T006→US5→US1→US2/US3→US4→Polish. Catalog is a prerequisite even though US5 is listed later in product spec. US2 privacy tests and US3 storage unit tests can be authored in parallel in separate files once services/contracts exist; do not concurrently edit shared schema or modules. No tasks are marked [P] because the current execution is sequential.

## Implementation strategy

MVP: foundation+catalog+own Sharing Skill with real HTTP/DB tests. Then add search/private files/reviewer decision incrementally. Mark completion only after the task's source and behavioral checks pass. Missing external integration environment remains an explicit pending release gate, not a checked task or a runtime success claim.

## External release gate

- [ ] T026 Run S3/private bucket and ClamAV end-to-end through configured production adapters, plus deployment bootstrap/TLS and migrations on a staging environment. Local provider fixtures are not evidence of this gate. See validation.md.
