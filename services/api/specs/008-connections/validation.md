# Validation: Kết nối — Proposal, Chat và SSE

**Date**: 2026-10-10. **Status**: Core API implementation and local checks complete; real-store/release proof pending. Branch `feat/connections`. Changes are limited to `services/api`; no dependency installation, commit, push or deployment.

## Proposal schedule text amendment — 2026-10-19

`candidateSlots` is now optional normalized text (`string | null`) throughout
create/update/read and runtime PostgreSQL storage. Omitted PATCH preserves the
stored suggestion; null, whitespace or HTML-only text clears it. Old arrays and
other non-string inputs fail validation. The historical catalog is retained;
the runtime generator overlays nullable TEXT and generates the checked schema.

- `pnpm --filter api db:generate:runtime-schema`, `db:validate`, `check-types`,
  `lint` and `build`: passed.
- Focused Node suites `policies`, `proposals`, `bootstrap`, `notifications`:
  **15 passed, 0 failed, 0 skipped**. Covered schedule normalization, old payload
  rejection, create projection, omitted/null/blank PATCH and preserved expiry.
- Real PostgreSQL `persistence` and `schedule-migration` suites:
  **2 passed, 0 failed, 0 skipped**, using disposable schemas on the configured
  local server. Covered the complete migration chain, persisted/read schedule
  text through Prisma and acceptance, legacy array timestamp preservation,
  nullable/default storage and absence of lifecycle UPDATE triggers during type
  conversion. Local TCP initially returned sandbox EACCES; rerun with approved
  localhost access passed. No application schema migration was applied.

Constitution check after implementation: modular/API scope, PostgreSQL authority,
owner boundaries, atomic migration, existing authorization/transaction rules,
published Swagger contract and focused/runtime verification Pass for this change.
Production migration, coordinated client/API rollout and device integration remain
pending. This is a breaking payload/response change; populated old arrays are
retained as JSON text, not guessed recurring availability. No commit/push/deploy.

**Update 2026-10-11:** Native local runtime checks now passed: real PostgreSQL **1 pass / 0 skipped**, native Mongo replica-set **1 pass / 0 skipped**, and full AppModule HTTP/SSE **12 grouped checks pass**. No Docker was used. The configured application still lacks the Connections migration, Mongo replica-set/index setup, enabled storage and a nonempty LR moderation rule set. See [local validation](local-validation.md) for current findings and exact limits; the 2026-10-10 skipped-suite results below are historical.

**Subsequent Mongo update 2026-10-11:** the configured Windows Mongo service is now writable `rs0` PRIMARY, its original dbPath retained, `.env` updated and all five chat indexes created in `skillhub_chat`. The same 12 HTTP/SSE groups and real Mongo suite passed against that service using disposable fixtures. Mongo topology/index gates are resolved locally; PostgreSQL application migration, storage, moderation and broader release proof remain pending. See the applied-update section in [local validation](local-validation.md).

## Executed checks

**Latest local update 2026-10-11:** Connections migration and configuration seed are applied locally; the running API returns health/ready 200. The configured-Mongo HTTP harness with `--live-storage` passed **13 grouped checks**, including real R2 upload, asynchronous ClamAV READY/CLEAN scanning, attachment publication/retry and authorized signed download. Test objects and schemas/databases were cleaned up. The application moderation rule set is still empty; publish remains blocked. Earlier missing-infrastructure statements above are historical snapshots. See [local validation](local-validation.md) for exact scope and remaining gates.

| Command/check                                                          | Result                                                                                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime schema generation + Prisma format/generate                     | Pass; Proposal overlays and 3 technical Connections models are generated                                                                                            |
| `pnpm db:validate`                                                     | Pass                                                                                                                                                                |
| `pnpm check-types`; final `pnpm exec tsc --noEmit --incremental false` | Pass                                                                                                                                                                |
| `pnpm lint` after final source/test changes                            | Pass, zero warnings                                                                                                                                                 |
| `pnpm test:connections` (`nest build` then Node tests)                 | 26 tests: **24 pass, 0 fail, 2 skipped**                                                                                                                            |
| `node scripts/test-connections-regressions.mjs` after completed build  | **188 pass, 0 fail, 0 skipped**; foundation/identity/RBAC/consistency/audit/configuration/files/LR/Skills and runtime-v3 repository regressions                     |
| Feature Nest composition/Swagger metadata                              | Pass with isolated owner/provider fixtures; workers registered for `chat.message.publish` and `application.events.wakeup`; proposal/conversation/SSE routes present |
| Git scope/branch/diff and Markdown links                               | API-only, feat/connections; diff --check passes, 30 local links resolve and Prettier check passes                                                                   |
| Docker engine for isolated real-store suites                           | Unavailable: Docker Desktop Linux engine named pipe absent; no application DB/Mongo/Redis configuration used as a test fallback                                     |

The first regression attempt overlapped a Nest build, causing transient missing `dist` imports, and the sandbox blocked local ClamAV TCP fixtures. Final regression ran after build completion outside the sandbox and passed. Tests now document sequential build/test use. These local TCP fixtures are scanner protocol tests, not a live S3/ClamAV deployment proof.

## What source and focused tests establish

| Group                  | Implemented behavior / tested boundary                                                                                                                                                                                               | Remaining evidence                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Access                 | USER grants, party/participant scope, sorted user locks, original token/live checks, no STAFF/ADMIN bypass; delivery rechecks after Mongo I/O                                                                                        | Real revoke/lock/source races and full authenticated HTTP/provider journeys                                             |
| Proposal input/source  | Exact target SharingSkill, derived parties, direct proposer need not teach target skill, request teacher check, seven-day unchanged expiry, quota boundary 10/hour and 50/day plus cooldown, normalized hints/decimal hundredths     | Real catalog/archive/verification and competing create/decide races                                                     |
| Accept                 | Current Request revalidation, expected source/version conflicts, expiry and recipient denial; Conversations owner called in PG transaction; no financial/session/path writes                                                         | Real PostgreSQL migration, partial uniqueness, competing accept/cancel/expiry/revoke and fault rollback                 |
| Chat identity/recovery | PREPARING survives missing draft/retry; COMMITTED outbox; crash after Mongo publication before PG ack; retry preserves identity/sequence and emits once; missing committed draft never fabricated                                    | Mongo replica-set transaction/stepdown/write-conflict and multi-worker proof                                            |
| Read/history           | Published-only history, BSON Long strings, recipient watermark projection, monotonic Mongo transaction plus durable read intent implemented                                                                                          | Real concurrent read/bridge crash and resync journeys                                                                   |
| Files                  | Uploader-owned CHAT READY/CLEAN manifests, immutable binding/generation, sorted locks, count/aggregate caps and server-only private metadata                                                                                         | Real upload/scanner/signed download/cleanup-versus-commit and exact streaming cap proof                                 |
| Notifications          | Generic in-app reference payloads; only delivery CAS winner creates notification; SQL owner create/read triggers cover existing LR/verification/inbox paths                                                                          | Real trigger atomicity/dedupe, historical producer/provider journeys                                                    |
| Cards                  | Client SYSTEM/actor/card metadata rejected; future OwnerChatCardReader interface only                                                                                                                                                | Path/Schedule producer, current object/version hydration and confirmation actions belong to future owner features       |
| SSE                    | Header auth, connect-before-snapshot anchor, reference frames and suppressed checkpoints, signed cross-user/tamper rejection, future cursor pre-header failure, replay gap reset, auth-loss close, buffer bound and shutdown cleanup | Actual PG replay/Redis leases across two instances, wakeup loss/outage, proxy flush/idle timeout and slow consumer load |
| Policy                 | Approved business defaults in policies.md; optional session-count/ONE_WAY bound configuration fails only affected hint; no business purge/staff browser/external channels                                                            | Product retention/report/case-access/external-channel decisions and production capacity                                 |

## Real-store suites present but skipped

- `test/connections/persistence.test.mjs` requires explicit `TEST_DATABASE_URL`. It creates a disposable schema, runs migration history and tests competing acceptance, stable replay, zero financial/session changes, notification create/read and feed dedupe, including retry after simulated feed trimming. Live eligibility/audit are fixtures in this suite; it is not a complete acceptance race matrix.
- `test/connections/mongo.integration.test.mjs` requires explicit `TEST_MONGODB_URI` pointing at an isolated replica set. It creates a separate database and explicit indexes, then tests draft exclusion, concurrent publication/sequence and monotonic read intent.
- `test/connections/compose.yaml` provides disposable PostgreSQL/Mongo rs0/Redis configuration; engine startup was unavailable, so no container/store test ran.

Missing URLs produce explicit skips. **Skipped suites are not passing release gates.** No migration was applied to an application database and no Mongo production indexes were created by this task.

## Deployment and outstanding gates

Use [quickstart](quickstart.md) for migration/index commands, isolated fixture URLs, approved policies and SSE client flow. SQL migration preflight refuses non-null historical Credit suggestions and legacy direct proposals with unresolved units/target identity; operators must resolve those and invalid/duplicate rows before deployment.

Notification/file feed writes use owner SQL triggers; proposal/chat notification creation uses Notifications' exported contract, and acceptance uses Conversations' lifecycle contract. PostgreSQL rolling quota counts share enforcement with durable writes; Redis broadcasts wakeup hints and leases SSE connections. Replay trimming is an operational cache operation; retained wakeup outbox rows preserve source/type/recipient dedupe. Business message/file/receipt purge is disabled pending retention policy.

Learning Request owner adapters for catalog, eligibility, public owner and Sharing Skill matching are implemented. Path/Schedule RequestLockReader stays unavailable; cancellation depending on it is still blocked. Trusted Path/Schedule card producers and report/case-scoped staff access remain deferred.

Before release: run isolated migrated PG acceptance/source/revocation/rollback races, real Mongo recovery/stepdown and read bridge, two API instances with lost Redis wakeups and reconnect, shared connection lease/proxy/backpressure tests, S3/scanner/cleanup races and performance fixtures. No P95, production readiness or user acceptance is claimed.
