# Session / LiveKit execution ledger

Plan: `services/api/specs/010-session-livekit/plan.md`.

- 2026-10-19: User approved implementation using Ponytail. Execute in current
  feature branch; preserve existing env changes and untracked planning files.
  No commit/push or production configuration changes requested.
- Ruling: reuse current feature checkout because it contains the user's env setup
  and approved plan; no new worktree or branch mutation.
- Ruling: approval to implement the proposed plan accepts ONGOING/late-grace token
  renewal and first verified media activity as ONGOING; early/late values remain
  explicitly unset. No new business defaults.
- Pre-flight: Task 1 policy/config → Task 2 token/read DTO → Task 3 provider
  observations → Task 4 settlement core → Task 5 regression. No conflicting types.
- Task 1: complete. Official SDK 2.19.1 installed; env/policy and no-default
  seed behavior verified RED → GREEN.
- Task 2: complete. Participant permission, membership, token grants/expiry,
  no-store and Swagger envelope verified through HTTP on loopback.
- Task 3: complete. Raw signed webhook, receipts, lifecycle, room recreation,
  reschedule fencing and worker paging/recovery verified.
- Task 4: complete. First confirmation immutable on retries, TWO_WAY N/M,
  completion outbox and guarded one-time settlement verified.
- Task 5: local verification, Cloud media/reconnect and provider-originated
  public HTTPS webhook delivery complete. See final follow-up evidence below.

## Implementation rulings

- Keep all changes uncommitted on the current branch; existing `.env.example`
  additions are preserved. No new schema migration or user database writes.
- Batch compiled tests after one build rather than repeatedly rebuild identical
  output for each package script. Full package lint/type/build still run.
- Optional config keys must not break unrelated updates: the update use case
  returns required defaults and present optional keys, without inventing values.
- Add a small audited operator CLI because the generic config update use case is
  intentionally private; no public admin endpoint or production default added.
- READY is a presentation/join state before start, so rescheduling still obeys
  the existing 60-minute cutoff. Applied reschedules reset CONFIRMED and keep
  history; stale snapshots/events are fenced by the latest schedule/SID.
- SDK webhook time has second precision; schedule-time fence uses the same
  precision. Recovery handles missing observations. Attendance totals remain
  unavailable and are never inferred from first/last timestamps.

## Verification evidence — 2026-10-19

- `pnpm --filter api lint`: PASS, zero warnings/errors.
- `pnpm --filter api check-types`: PASS, Prisma 7.8 generate + TypeScript.
- `pnpm --filter api build`: PASS, full Prisma/Nest build.
- Batched Node tests covering Session, HTTP/webhooks, learning-platform phases,
  audited reschedule, configuration, UTC, BIGINT and log privacy: **88 passed,
  zero failed**, three legacy config DB tests skipped without TEST_DATABASE_URL.
- PostgreSQL 17 temporary container on loopback port 55434, separate test DB;
  UUID schemas created/dropped by existing harness: **2 integration tests passed**.
  These exercise existing finalize/Hold rollback plus actual USER permission seed,
  concurrent token mapping, receipt rollback/duplicate, stale observations,
  concurrent dual confirmation, blocking dispute and concurrent final settlement.
- Independent read-only review found optional-config/SID/schedule/overflow issues;
  fixes have RED → GREEN regression tests. Follow-up review: no unresolved
  important findings; focused review tests 15/15 passed at that point.

The unit/HTTP command (run from `services/api` after build) was:

```powershell
node --test test/learning-sessions/*.test.mjs test/learning-platform/phase*.test.mjs test/learning-platform-audit.test.mjs test/bigint-responses.test.mjs test/configuration-policy.test.mjs test/configuration-persistence.test.mjs test/configuration-update.test.mjs test/configuration-update-persistence.test.mjs test/provider-configuration.test.mjs test/log-privacy.test.mjs test/time-policy.test.mjs
```

Integration command used only the temporary TEST_DATABASE_URL:

```powershell
node --test --test-concurrency=1 test/learning-sessions/integration/*.test.mjs test/learning-platform/finalize.integration.test.mjs
```

## Remaining external checks

- Configure an approved joinWindow before enabling actual joins; no values were
  written to the developer/production DB in this session.
- Real LiveKit Cloud: signed public HTTPS webhook delivery, two client connections
  and token reconnect passed with synthetic media as recorded below. Provider
  outage, media quality/load and force-disconnect policy remain separate checks/
  decisions; local signed fixtures alone are not provider-originated proof.
- Video UI SH-074 and exact attendance seconds are outside this backend delivery.
- Existing 48-hour Reports dispute guard is preserved, not newly approved as a
  product default. Completion timeout/no-show/cancellation remain product decisions.

## Follow-up verification and Cloud smoke — 2026-10-19

- User selected backend verification + Cloud smoke. All test data used the
  disposable `skillhub-livekit-smoke-pg` PostgreSQL 17 container on loopback
  port 55434; developer/production DB and joinWindow were not changed.
- Applied all 20 existing migrations to the temporary test DB. The expanded
  regression run above, adding Session persistence and finalize integration,
  passed **93/93, zero failed, zero skipped**. This includes the three legacy
  configuration persistence checks previously skipped. Their first attempt
  lacked public-schema migrations; rerun after migrating passed.
- Actual Cloud project `skillhub-dev-rmj6hhf4.livekit.cloud`: authenticated
  RoomService API read passed. No API keys, secrets or JWTs were printed.
- A one-off harness reused the PostgreSQL fixture and production Session HTTP
  controllers, IdentityGuard, real auth sessions and LiveKitService. Two fixture
  users received tokens via `POST /api/v1/sessions/:id/livekit-token` with 200
  and `Cache-Control: no-store`; a real authenticated outsider received 403.
- Two native RTC clients connected to the same Cloud room using those API-issued
  tokens. The subscriber received synthetic audio/video (168 audio frames and
  6 video frames at the first assertion). Cloud reported two participants and
  two published tracks; no camera, microphone or personal media was used.
- Production `listActiveParticipants` + `advanceLifecycle` consumed the real
  Cloud snapshot and persisted `ONGOING` in the isolated test schema.
- Learner disconnected, fetched a new token through the HTTP endpoint, and
  joined with a new client instance. Room and participant identity remained
  stable; both audio and video frames resumed and Cloud showed two participants.
  Reusing a disconnected Room in temporary `@livekit/rtc-node` 1.1.0 initially
  failed with `Participant already exists`; its remote-participant map survives
  disconnect. The rerun creates a fresh client and passes; no backend workaround
  or client dependency was added to the repository.
- Harness exited 0 and deleted the temporary Cloud room and UUID test schema.
  RTC tooling/harness was kept in host TEMP, outside repository dependencies.
- Final API lint, type check and build passed after removing the temporary
  harness from the repository. Additional payment HTTP/payOS regressions passed
  **16/16**, including normal JSON parsing and signed public callback handling.
- Temporary PostgreSQL container was stopped/removed. A final authenticated
  Cloud API check reported zero active rooms. `git diff --check` passed.
- At the first follow-up, the dashboard required sign-in, so Cloud-originated
  delivery was pending. This was completed in the final follow-up below.

### Webhook follow-up

- User completed dashboard login; confirmed the `skillhub-dev` project has no
  existing webhook endpoints. Prepared a temporary receiver using the production
  controller, real signature verification and an isolated PostgreSQL fixture.
- The public gateway forwards only POST `/api/v1/livekit/webhook`; a local probe
  confirmed the Session token endpoint returns 404 through the gateway.
- Automatic approval review rejected starting an ngrok tunnel because forwarding
  project webhook room/participant metadata through ngrok was not specifically
  authorized. Requested explicit authorization; no workaround was attempted.
- No tunnel or Cloud webhook was created. Stopped the waiting receiver and removed
  its disposable DB container while awaiting authorization or a user HTTPS endpoint.
  At this checkpoint delivery remained pending; later authorization and results
  are recorded below.

### Final authorized Cloud webhook smoke

- User explicitly approved temporary ngrok forwarding of `skillhub-dev` room/
  participant metadata and cleanup afterwards. Started the narrow test gateway
  with request inspection disabled; no production policy or developer DB writes.
- Created only `codex-session-smoke-temporary` in the dev project, signed with
  the existing API key matched to backend env using boolean comparison. Provider
  events went through ngrok to the production controller/SDK/real PostgreSQL
  receipt consumer in a disposable fixture.
- Real delivery exposed two integration bugs missed by UUID/local-clock fixtures:
  Cloud uses opaque `EV_…` event IDs, and provider timestamps were 0.5–1.2 seconds
  ahead of the DB. UUID-only ingress returned 400; strict future-time ACK discarded
  valid observations. Immediate 503 retries alone exhausted before DB caught up.
- Fixed opaque IDs with bounded validation and namespaced SHA-256 -> UUIDv8
  receipt mapping, preserving old UUID identities. No new dependency or migration.
- Fixed small clock skew with a five-second technical bound and DB-time clamp.
  Window/state/attendance do not use future times; raw provider time remains the
  schedule fence. Larger skew throws 503 and rolls back the receipt for retry.
  Signed HTTP regression checks cover replay/dedupe, empty ID, small skew, larger
  future rollback and same-payload retry; a separate early-start test preserves
  READY before DB startAt. PostgreSQL verifies future-event receipt rollback.
- Final Cloud harness **exited 0**. Both real participant join observations were
  persisted, receipts stored as UUID, and Session reached ONGOING **before** calling
  recovery. Initial delivery count was five HTTP 204 responses (room start, two
  joins, two tracks). Synthetic media received 228 audio and six video frames at
  the initial assertion. Token renewal/reconnect and resumed media passed.
- Signed participant leave observations persisted; room/track finish events were
  ACKed 204. The successful run needed no 503 retries. No camera/mic/private media.
- Final lint, type check and build passed. Expanded regression including payments
  passed **110/110, zero failures, zero skips** against the migrated test container.
  Focused independent source review reported no actionable findings.
- Deleted the temporary webhook in Cloud; dashboard confirms no webhook endpoints.
  Stopped ngrok and removed the disposable PostgreSQL container. Final authenticated
  Cloud API read reported zero active rooms. Screenshot evidence is saved outside
  the repository as `livekit-webhook-cleanup.png` in the chat artifact directory.

Join-window values used by the isolated fixture are test inputs only. Production
policy, forced media disconnect, quality/load testing and SH-074 remain open.
