# Tasks: Kết nối (proposal, chat, SSE)

Paths below are relative to `services/api`. Implementation authorized on 2026-10-09;
release gates remain distinct from permission to implement.

## Setup

- [x] T001 Inspect scoped guidance, existing owners and design in `AGENTS.md` and `specs/008-connections/plan.md`.
- [x] T002 Record approved business defaults in `specs/008-connections/policies.md`.
- [x] T003 Add validated connection configuration in `src/modules/proposals/domain/connection-policy.ts` and `.env.example`.

## Foundation

- [x] T004 Add generated runtime overlays and technical models in `scripts/generate-runtime-schema.mjs` and `prisma/runtime-support.prisma`.
- [x] T005 Add preflight, constraints, indexes and permissions in `prisma/migrations/20261009010000_connections/migration.sql`.
- [x] T006 Add live account/source eligibility contracts in `src/modules/users/application/services/skill-actor.service.ts` and `src/modules/sharing-skills/application/sharing-skills.service.ts`.
- [x] T007 Add transactional recipient feed and signed cursor in `src/modules/application-events/application/application-events.service.ts`.
- [x] T008 Add broadcast wakeup, leased connection limits and bounded SSE transport in `src/modules/application-events/presentation/events.controller.ts`.
- [x] T009 [P] Test policy boundaries and signed cursor isolation in `test/connections/policies.test.mjs`.

## US1 — Proposals

Independent verification: request and direct sources, party scope, duplicate/rate limits,
unchanged expiry on update, version/replay conflicts and terminal expiry.

- [x] T010 [US1] Implement proposal normalization in `src/modules/proposals/domain/connection-policy.ts`.
- [x] T011 [US1] Implement create/list/get/update/withdraw/reject in `src/modules/proposals/application/proposals.service.ts`.
- [x] T012 [US1] Implement typed HTTP commands and Swagger in `src/modules/proposals/presentation/proposals.controller.ts`.
- [x] T013 [US1] Add overdue proposal recovery in `src/modules/proposals/application/proposal-expiry.service.ts`.
- [x] T014 [US1] Test source checks, scope, expiry and CAS in `test/connections/proposals.test.mjs`.

## US2 — Accept

Independent verification: exactly one Conversation per accepted proposal/request; Request
becomes NEGOTIATING, current skill/parties validated, no financial/session writes.

- [x] T015 [US2] Implement atomic acceptance in `src/modules/proposals/application/proposals.service.ts`.
- [x] T016 [US2] Implement participant metadata queries in `src/modules/conversations/application/conversations.service.ts`.
- [x] T017 [US2] Verify acceptance races and stable replay in `test/connections/persistence.test.mjs`; local PostgreSQL suite passed on 2026-10-11 (see `local-validation.md` for fixture boundaries).

## US3 — Text, read and live events

Independent verification: immutable draft saga survives each crash boundary; hidden drafts,
stable sequence, sender-only receipt, monotonic read and authenticated SSE replay.

- [x] T018 [US3] Add explicit Mongo indexes and transaction-backed publication/read repository in `src/modules/conversations/infrastructure/chat.repository.ts`.
- [x] T019 [US3] Implement PG receipt/draft/commit send saga in `src/modules/conversations/application/conversations.service.ts`.
- [x] T020 [US3] Implement retryable publication and read-intent bridge in `src/modules/conversations/application/chat-publication.service.ts`.
- [x] T021 [US3] Implement history/read/delivery HTTP routes in `src/modules/conversations/presentation/conversations.controller.ts`.
- [x] T022 [US3] Configure replica set and explicit index migration in `compose.yaml` and `scripts/migrate-chat.mjs`.
- [x] T023 [US3] Test saga recovery, digest conflicts and sequences in `test/connections/chat.test.mjs`.
- [x] T024 [US3] Test SSE replay, reconnect, revocation and backpressure in `test/connections/events.test.mjs`.

## US4 — Safe files

Independent verification: uploader-owned CLEAN/READY CHAT files only, immutable server
manifest, sorted locks, count/aggregate caps and participant-authorized downloads.

- [x] T025 [US4] Add CHAT manifest/binding contracts in `src/infrastructure/storage/file-attachment.service.ts`.
- [x] T026 [US4] Add upload/status/download routes in `src/modules/conversations/presentation/conversations.controller.ts`.
- [x] T027 [US4] Seal and verify attachment manifests in `src/modules/conversations/application/conversations.service.ts`.
- [x] T028 [US4] Test ownership, generation changes and caps in `test/connections/files.test.mjs`.

## US5 — Notifications and owner cards

Independent verification: existing and connection notification create/read transitions append
reference-only events once; clients cannot inject business cards.

- [x] T029 [US5] Integrate notification feed at owner write boundary in `prisma/migrations/20261009010000_connections/migration.sql (owner create/read triggers)`.
- [x] T030 [US5] Integrate verification and connection producers in `src/modules/notifications/application/services/connection-notification.service.ts (existing verification/LR paths covered by owner triggers)`.
- [x] T031 [US5] Add future trusted owner-card interface in `src/modules/conversations/application/owner-card.contract.ts`; no owner producer is registered.
- [x] T032 [US5] Verify notification/card privacy in `test/connections/notifications.test.mjs`.

## Cross-cutting verification

- [x] T033 Compose modules and real implemented Learning Request adapters in `src/app.module.ts` and `src/modules/learning-requests/learning-requests.module.ts`.
- [x] T034 Add focused scripts and client/deployment guidance in `package.json`, `README.md` and `prisma/README.md`.
- [x] T035 Run generated-schema, types, lint, focused and affected regressions; record evidence in `specs/008-connections/validation.md`.
- [ ] T036 Execute isolated real-store concurrency/recovery and SSE multi-instance checks in `test/connections/persistence.test.mjs` and record unavailable external proof explicitly.

## Dependencies and execution

T001–T009 precede stories; US1 → US2 → US3 → US4. US5 depends on recipient feed
and US2; existing notification integration can run independently of Mongo work.
Focused checks and affected regressions run after implementation; evidence is recorded in validation.md.
MVP is US1+US2; the authorized implementation continues through all five stories.
Parallel opportunities (separate files, after prerequisites): US1 policy tests/DTOs;
US2 metadata queries/acceptance tests; US3 Mongo index script/SSE tests;
US4 file tests/upload DTOs; US5 notification tests/card tests. These are dependency
examples, not instructions to start other agents.

## Remaining release verification

T017 passed on installed local PostgreSQL on 2026-10-11. The configured Mongo replica-set suite and 13 full AppModule HTTP/SSE check groups also passed, including a harmless CHAT upload/scan/download journey against real R2/ClamAV; see [local validation](local-validation.md). T036 remains pending for broader source/revocation/recovery races, Redis multi-instance/proxy, storage cleanup races and load proof. Completed checkboxes do not establish production readiness.
