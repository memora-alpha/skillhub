# Identity implementation validation

Date: 2026-10-03. Branch: `feat/user-identity`. Planning/schema baseline committed as `a3eb599` (`feat(api): define identity specification and product schemas`), with root formatting/lint/commitlint hooks. Implementation follows local `speckit-implement` and the prerequisite `speckit-tasks` workflow. Requirements checklist: 16/16 complete. No before/after implementation extension hooks are registered.

## Runtime v3 update (2026-10-07)

The runtime now uses the v3 domain schema through `prisma.config.ts` and
`prisma/schema.prisma`: inline User profile fields, one roleId, and v3 SQL column
names. Seven technical OTP/foundation models preserve implemented functionality.
The upgrade migration backfills existing data and archives original profile/grant
tables. The migration preservation test and v3 repository tests pass; API lint,
typecheck and build pass. This has not deployed migrations to the application DB.
Earlier evidence below describes the original identity implementation.

## Delivered scope

All 21 method/path pairs in [HTTP contract](contracts/http.md) are implemented under `/api/v1`. Nest URI versioning excludes unversioned identity aliases; health/readiness remain version-neutral and Swagger remains `/api/docs` in development/test. Auth, users, notification and audit owner contracts share explicit PostgreSQL transaction contexts. No finance, chat, OAuth, online Admin grant or frontend implementation is included.

The identity migration introduces fourteen identity models and SystemConfiguration metadata, eight enums, normalized-email/counter/range/time/state CHECK constraints, outstanding-OTP partial uniqueness, ownership composite FKs and an append-only audit trigger. The complete 45-model catalog remains available in `prisma/catalog.prisma`; `prisma/schema.prisma` is derived by `scripts/write-identity-schema.mjs` for current migration scope. Future catalog tables have no migration yet.

## Verification evidence

- Initial policy test was run before crypto implementation and failed on missing implementation. A contract-availability smoke test also failed before the corresponding services existed; the full behavioral integration matrix was added as implementation developed. Not every individual scenario had a separate observed red run.
- Typecheck and build passed during development. PostgreSQL testing found and corrected Prisma's inability to deserialize the advisory lock function's void result. HTTP testing found and corrected acceptance of an empty profile patch after DTO transformation.
- Crypto/input/config/DTO tests verify Argon2id, purpose/context-bound OTP and authenticated ciphertext, confirmation/terms/field allowlists, secret-safe startup errors and production reputation requirements.
- Real PostgreSQL migrations are applied to uniquely named `identity_test_<UUID>` schemas, with explicit adapter schema and PostgreSQL search path. Fixtures seed definitions twice; tests drop only that validated disposable schema in `finally`. No migration was deployed into the existing application schema.
- Twenty concurrent normalized signups create one aggregate without replacing credentials/profile. Twenty OTP consumes commit one activation; twenty wrong attempts persist/cap at five. Twenty reset consumes commit one password change with session revocation, preserved locked status and one notification.
- Refresh races issue at most one successor; replay revocation survives HTTP rejection and invalidates that successor. Current/all logout, reset and lock reject subsequent old access tokens. Login/refresh versus lock, live delegated Staff grants/revocation and audit/proof rollback have targeted checks.
- Outbox checks cover committed ID-only intent, expired lease recovery, reconstructed sender, duplicate processing, stale/exhausted proofs, bounded provider failures, terminal ciphertext erasure and previous-key-ring delivery/OTP verification. Real Redis counters and a real BullMQ queue/worker use a disposable prefix; counters use fixture-only random HMAC keys and expire after sixty seconds.
- Avatar tests cover private/public projection allowlists, foreign asset denial, actual decoding, MIME mismatch, quarantine, infected/scanner-failure preservation, clear versus delayed worker and cleanup. Image bytes and provider fault injection are controlled fixtures, while avatar metadata and transitions use real PostgreSQL.
- Actual SMTP, S3 and ClamAV adapters are exercised over local TCP/HTTP protocol servers. S3 requests are signed without a public ACL; SMTP refusal and scanner invalid replies fail safely. These are adapter tests against controlled servers, not certification of production providers.
- HTTP/Swagger checks count all 21 versioned routes; health remains neutral, unsupported/missing versions return 404, protected calls require live identity, privilege/metric injections fail, public projections omit email/roles and token responses use no-store.

Final checks passed: API lint (zero warnings), full-catalog client generation/typecheck, identity deployment schema validation, Nest build and `git diff --check`. The complete rerun passed **27 Node test entries**: twelve foundation/policy/config/DTO/provider checks and fourteen real-storage/HTTP scenarios plus their parent suite. No skipped or failed tests. The final integration scenarios include delegated Staff grant revocation, login/refresh against lock, one-use proof rollback and key rotation.

## Architecture refactor verification — 2026-10-04

Implemented the Memora-informed refinement within specs 002 on `feat/user-identity`:

- 24 application use cases now handle authentication/session journeys, own/public profile reads and updates, administration, avatar processing/reconciliation and email delivery/reconciliation. HTTP controllers inject these use cases directly; cohesive OTP/session/reauth/account/projection/intent services remain separate.
- Five private Prisma repository adapters live in the owning modules' `infrastructure/persistence`, injected through application ports. Application no longer constructs Prisma where/create/update inputs or accesses model delegates. Explicit shared IdentityTx and generated record/enum types remain internal contracts; use cases own transaction boundaries and shared moderation services participate in the caller's transaction.
- Administrative listing uses a business UserListQuery. HTTP converts Multer to AvatarInput; application receives abstract storage/scanner/inspector/mail/job providers. Sharp, BullMQ processors, queue metadata and reconciliation timers live in infrastructure. Notifications read proof state through the auth-owned OTP service.
- Integration fixtures now compile `IDENTITY_APPLICATION_PROVIDERS`, the same application provider graph used by IdentityModule, with controlled external resources. Failure fixtures override the audit contract instead of recreating monolithic services. The operator seed/Admin script uses the new repository-backed owner contracts.

Final refactor checks passed: `pnpm --filter api lint` (zero warnings), `pnpm --filter api check-types` (full-catalog Prisma generation and TypeScript), `pnpm --filter api build`, foundation/policy/provider tests and real-storage identity integration tests. There are **27 passing Node test entries**, none failed or skipped. The fourteen integration scenarios plus parent include concurrent OTP/reset/refresh/lock, persistent invalid-attempt counters, replay revocation, audit/reauth rollback, recovery/key rotation, projections and all 21 versioned HTTP/Swagger routes.

The real BullMQ scenario also runs the extracted IdentityEmailWorker/BullIdentityEmailJobs and AvatarWorker/BullAvatarJobs with isolated queues and real PostgreSQL metadata. It verifies ID-only payloads, SENT email, CLEAN avatar selection and safe queue cleanup. Provider behavior remains controlled by fixtures; this is not production-provider certification or a full configured AppModule startup test. Schema, API behavior and deployment topology are unchanged; no application migration or push was performed. No before/after implementation hooks are registered.

## Memora response amendment verification — 2026-10-04

Reviewed Memora's live `shared/http/response.ts`, exception filter and controllers. Its success/paginated/failure types and helpers now live in SkillHub's shared HTTP layer; controllers explicitly format business results. No response wrapper is added to application use cases or a global interceptor. JSON health/readiness adopts the same envelope, with URI versions and status codes preserved.

- Success JSON has `success:true`, a string `message`, and `data`; neutral register/resend/forgot acknowledgment uses `data:null`. Admin user listing returns an array in `data` with `meta.pagination.nextCursor`, `hasMore` and `limit`.
- Exceptions use root `success:false`, string `message` and numeric `statusCode`. Validation messages join with `; `; 5xx returns `Internal server error` without credentials/provider details. Successful 204 endpoints remain bodiless.
- All 21 identity routes retain their versions and security behavior. Swagger checks inspect success/error schemas for every documented response, data model references, pagination arrays and absent 204 content. Actual HTTP checks cover register/duplicate acknowledgment, resend/forgot, verify, login/refresh/reauth with no-store, own/public/update profile projections, avatar upload/status/delete, health/readiness, 400/401/403/404 and logout/revoked identity.
- Real PostgreSQL/Redis cursor checks cover consecutive distinct records and the final page's null cursor/false hasMore; masked email and private-field allowlists remain intact. Existing concurrency, atomic audit/proof rollback, persistent OTP counters, replay revocation, outbox/key rotation and BullMQ worker scenarios also passed.

Verification passed: API lint with zero warnings, Prisma generation/TypeScript check, Nest build, `git diff --check`, foundation tests (5), policy/provider tests (7), and real-storage integration entries (15): **27 passed, none failed or skipped**. Repository frontend/shared source search found no consumers of the identity endpoints to update. This is the user-approved replacement of the unreleased v1 response contract; consumers read payloads from `data` and pagination from `meta.pagination`. Production-provider/full configured startup limits below still apply; no migration deployment accompanies this amendment. The user requested a separate response amendment commit and pull request into dev on 2026-10-04.

## Release configuration and limitations

Required keys, terms/timezone, lifetimes, throttling, delivery/retention and avatar timing values are explicit in `.env.example`; blanks intentionally prevent identity startup. Initial reputation must be approved in production; Staff has no initial administrative permissions. Registration proof lifetime, attempt cap and resend boundaries implement the SRS values (300 seconds, five attempts, sixty seconds, five issues/hour).

SMTP, S3 credentials/private bucket policy and a reachable ClamAV service must be configured before production use. The existing ignored developer `.env` has not been populated with invented policy values. No production email was sent or cloud deployment performed. Docker Desktop was unavailable; real configured PostgreSQL/Redis services were used instead. Mongo readiness regression uses controlled connection fixtures; chat behavior is outside scope.

External email may duplicate if a provider accepts it before a worker crash; domain proof consumption stays one-use. S3 bucket must deny public access and apply an orphan-object lifecycle: a crash between putting bytes and committing asset metadata cannot be transactionally rolled back across PostgreSQL/S3. Quarantined assets retry with expiring leases; old/unreferenced bytes are cleaned idempotently. Provider cleanup outages retain metadata for subsequent reconciliation. Historical session/proof digests are retained; no unapproved destructive history purge is enabled. Terminal email records follow the explicitly configured retention window.

Maintain previous OTP/encryption keys until associated challenges/intents expire or drain. Missing historical keys fail closed. JWT signing-key rotation invalidates prior access tokens; refresh families still require live status/securityVersion checks. Clients must serialize refresh: strict replay has no grace period and requires another sign-in after a lost refresh response is retried.

Production resource sizing/load testing and production-provider acceptance remain operational release checks, not claims established by the fixtures here. The pre-implementation baseline is `a3eb599`. The user requested a separate implementation/refactor commit on 2026-10-04; Git history records that commit. No deployment or push is included.

## Redis OTP / Memora flow amendment — 2026-10-08

Implemented the user-requested Redis-owned OTP design described in [redis-otp.md](redis-otp.md). Historical PostgreSQL proof/outbox descriptions above are retained as previous validation, not the current runtime architecture.

- Runtime Prisma has no OtpChallenge/OtpIssueWindow model or challenge foreign key. The new migration was executed only in disposable integration schemas; assertions confirm both OTP tables are absent from the operational schema. The initial archive variant was superseded by the later dev-only cleanup below.
- Nest build and TypeScript no-emit check passed. API ESLint passed with zero warnings. Diff whitespace checks passed.
- Identity integration: **20/20 entries passed**, including registration concurrency, one successful OTP consume, wrong-attempt caps, 300-second Redis TTL and expiry, stale-job suppression, five-issues/hour, 24-hour email softban across replacements and purposes, enqueue-failure/account-commit recovery, reset concurrency, rollback, sessions/RBAC, all 21 HTTP routes, key rotation and real BullMQ delivery.
- Identity policies/providers/regressions: **12 tests passed** across the policy/regression run and final provider run. The added SMTP regression checks blank TLS on port 465 and display-name sender fallback; provider mail goes only to a controlled localhost mailbox. The first version of that new test mocked a different Nodemailer module instance; it was corrected to mock the runtime's CommonJS module and the provider suite passed.
- Affected consumers: Skills module bootstrap passed against a disposable PostgreSQL schema; three runtime-v3 repository regressions passed. Shared test fixtures resolve the Redis-backed identity graph. Temporary schemas and new long-lived Redis test counters are cleaned up.

Application deployment remains separate: no migration, role seed, commit, push or new real email was performed during this implementation. Read-only inspection found the configured application database has an empty roles table and lacks foundation audit columns, so passing isolated integration tests does not establish that its full live journey is ready. Reconcile that partially provisioned v3 schema and seed roles before the next end-to-end mailbox test. Do not replay all historical CREATE TABLE migrations blindly against existing tables.

The user approved Memora-style post-commit enqueue. Account creation/password update and Redis/BullMQ are not distributed transactions; see the documented retry/resend behavior and the principle-8 design exception in redis-otp.md.

## Create account only after OTP — 2026-10-08

This later user instruction supersedes the account-before-email ordering described in the preceding amendment. Registration now stores only an encrypted draft in Redis; the database User/USER assignment and EMAIL_VERIFIED audit are committed only after a valid OTP. No application migration or seed was run for this ordering change.

Validation passed: Nest build, TypeScript no-emit, API ESLint with zero warnings and diff whitespace checks. Identity integration passed **22/22 entries** on real PostgreSQL/Redis and disposable BullMQ queues with a controlled mailer. It asserts zero User rows after concurrent registration, immutable encrypted draft/password hash, exactly one verified ACTIVE User after concurrent OTP requests, draft consumption, expired-draft resend creating nothing, audit rollback creating no User, and retry after post-commit Redis cleanup failure creating neither another User nor another audit. Existing reset/session/RBAC/key rotation/HTTP/worker cases remain passing.

Swagger and the HTTP contract now state that register stages data and verify creates the account. The endpoint paths, body fields, neutral 202 response and bodiless verification 204 remain unchanged. Reserved UUID and accepted terms time/version are carried to the user repository so retries and delayed verification preserve the original registration context. Legacy pending database accounts are not silently deleted or activated by draftless proofs.

## Development-only OTP cleanup — 2026-10-08

The user confirmed this is development and old OTP records do not need preservation. The new Redis OTP migration now drops the two obsolete OTP tables and legacy delivery payload columns directly, without archive schemas or data copies. Historical migrations for unrelated runtime-v3 changes are unchanged. Test cleanup no longer references an OTP archive; integration asserts the archive namespace is absent. This edits the migration source only; it does not reset or mutate the configured application database.

## Development database synchronization and live signup — 2026-10-08

The user subsequently authorized synchronizing the configured development database and repeating the real signup/login journey. Inspection confirmed its existing schema contained no records and no migration history. A replacement schema was built through the repository migration chain and switched into the runtime namespace; the previous empty schema remains available for recovery. Identity roles and permissions were seeded through the existing bootstrap command.

Migration `20261008010000_runtime_schema_alignment` reconciles residual index names, timestamp defaults and the StoredFile update action with the runtime Prisma model. All 11 migrations are applied and Prisma reports no schema differences. OTP tables are absent. The identity integration fixture now includes this migration; all 22 entries passed again.

The authorized external mailbox journey passed: registration returned 202, SMTP delivery completed, and no database account existed before verification. A mailbox-provided OTP returned 204, login returned 200 with access/refresh credentials, and authenticated `/me` returned 200 with an ACTIVE, email-verified USER account. Tokens, passwords and OTP values are not recorded here. This supersedes the earlier development schema/seed blockers; it does not establish production deployment or acceptance of unrelated integrations.

## Separate recovery OTP verification and password reset

The user requested a distinct OTP verification step before password entry/update. The implemented contract is documented in [password-recovery.md](password-recovery.md): forgot (202), verify-otp (200 with one-use resetToken/expiry and no-store), reset (204 with email/resetToken/new passwords). Reset no longer accepts otpCode. No database migration is required for this recovery change; the earlier runtime schema alignment remains separate work.

Build, TypeScript no-emit and API ESLint passed. Identity policies/providers/regressions passed **12/12**. PostgreSQL/Redis/BullMQ integration passed **23/23 entries** after updating the Swagger endpoint assertion from 21 to 22. The first run stopped the HTTP case at that obsolete count; the corrected run exercises the new recovery HTTP contract through successful login. Tests cover wrong OTP/no grant, no password/securityVersion/session change at verify, exactly one grant from 20 concurrent verifications, digest-only Redis token storage, required token/legacy-body rejection, email/expiry/securityVersion/status binding, consumed/replaced token rejection, cooldown and in-flight-reset resend behavior, exactly one password update from 20 concurrent resets, audit rollback and all-session revocation. Existing signup, refresh, RBAC, key rotation and workers remain passing. Providers are controlled in this suite; no additional real-mailbox recovery or real-user password change is claimed.

The development API was restarted with the built implementation. Its live Swagger exposes password/verify-otp and a ResetDto containing resetToken without otpCode; an unknown-email OTP verification returns 400 OTP_INVALID_OR_EXPIRED. This smoke check sends no email and changes no real user's password.
