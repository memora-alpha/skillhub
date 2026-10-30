# Verification AI validation

Date: 2026-10-23. Branch: `feat/verification-ai`. Scope: API only.
Implementation/contract/rollout: [verification-ai.md](verification-ai.md).

## Revalidation before commit (2026-10-31)

Current branch: `fix/backend-limits-inbox`, after integration with dev's current
module layout and the limits/Inbox commit. The checks below are separate from the
original 2026-10-23 results retained later in this document.

- API TypeScript checking, Nest build, ESLint and runtime Prisma validation: passed.
- Combined Connections, list/cursor, identity/rate-limit, Skills, request/log
  privacy and Verification AI regressions: **80 tests, 73 passed, 0 failed,
  7 skipped**. Provider tests use fixtures; no live Gemini request was made.
- Two AI integration tests were skipped because explicit `TEST_DATABASE_URL` and
  `TEST_REDIS_URL` were not configured. The five other skips require isolated
  PostgreSQL/MongoDB/Redis for Connections, ordering/schedule migrations and limits.
- AI integration entry points now require the corresponding explicit test URI;
  they never fall back to the application's DATABASE_URL or REDIS_URL. PostgreSQL
  tests still create disposable schemas and Redis tests use disposable queues.
- Source and tests use application/services/ports and infrastructure gateway/jobs/
  persistence paths. Module composition and existing Connections/Skills fixtures
  were adapted to the added AI dependency without contacting production services.
- `git diff --cached --check`: passed. No application migration, permission seed,
  runtime AI activation, push or deployment was performed.

## Original local checks (2026-10-23)

- `pnpm --filter api check-types`: passed.
- `pnpm --filter api build`: passed.
- `pnpm --filter api lint`: passed, zero warnings.
- `pnpm --filter api db:validate:runtime`: passed.
- Runtime schema regenerated through the maintained generator, including explicit
  restrictive foreign-key update behavior matching the additive migration.
- Targeted combined Node test run: **64 passed, 0 failed, 0 skipped**. The run
  includes new AI policy/provider/module/PostgreSQL/HTTP/Redis tests and existing
  Skills journeys, HTTP/file/bootstrap, policy, storage-download, configuration,
  audit and outbox regressions.

Integration tests create/dispose isolated PostgreSQL schemas and a uniquely named
Redis queue. They do not apply the migration to the application's schema. Provider
responses in the automated suite are fixtures; SMTP/push are not contacted.
An existing pg driver deprecation warning about concurrent query scheduling was
observed in the shared fixture/driver path; it did not cause test failures.

Coverage includes:

- Submission/run/audit/outbox atomicity, command replay, concurrent requests and
  one active run per verification.
- Duplicate delivery calls the provider once; successful matching results are
  reused; recovery requeues expired leases with outbox publication; old lease
  holders cannot commit; attempts and manual run caps are enforced.
- Profile edits invalidate snapshots; queued stale work does not contact provider;
  late results cannot change Staff decisions, evidence status or badge.
- Live authentication/permissions, removed grants on idempotency replay, version
  conflicts, DTO unknown-field/key validation, private projections and nested Swagger.
- Disabled AI preserves submission/manual review; unsupported DOC retains manual
  review; modified stored bytes/checksums are rejected before provider generation.
- Fixed provider endpoint/header credentials, no model tools/URL fetching, image
  and PDF request structure, token-budget rejection before generation, sanitized
  provider errors, truncated/invalid JSON and invalid authenticity claims.
- Strict output validation, date citations, image source pages, evidence identity
  and conservative batch aggregation. These checks do not prove text was read
  correctly or that a document is authentic.

## Live provider checks

Two direct checks used the compiled **GeminiVerificationAdapter** with
`gemini-2.5-flash`. The key existed only in a temporary environment variable and
was removed afterward; it was not written to source, fixtures or `.env.example`.
No real SkillHub database profiles were sent. The image was an attachment the user
explicitly authorized for external analysis; the PDF contained synthetic text.

| Input                                                      | HTTP                                 | Runtime | Validated result                                                                                               |
| ---------------------------------------------------------- | ------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------- |
| Authorized HSK5 image with matching fixture profile/skill  | countTokens 200, generateContent 200 | ~11.8 s | MATCH, RELEVANT, SUPPORTS_SKILL, issuer UNVERIFIED; examinationDate 2021-03-20; issue/expiry null              |
| Synthetic one-page test PDF with explicit exam/issue dates | countTokens 200, generateContent 200 | ~11.4 s | MATCH, RELEVANT, NEEDS_REVIEW, issuer UNVERIFIED; examinationDate 2025-12-20, issuedAt 2026-01-01, expiry null |

These are sample interoperability checks, not a benchmark or a fraud-detection
accuracy evaluation. Initial generation was rejected (HTTP 400) because the fully
constrained nested schema exceeded Gemini decoder complexity. The final adapter
sends a simpler shape/enum schema while retaining all local Zod bounds; both live
checks passed with that design. No provider request/response body is application-logged.

## Remaining release boundaries

The backend feature is complete locally, default **disabled**. Runtime environment
and application database were not enabled/migrated/seeded by this work;
push and deployment remain pending. Before enabling: apply the migration, seed the
new Staff/Admin grant, set runtime Gemini credentials/limits and restart. Review
provider data handling for real production evidence.

Production S3/ClamAV-to-Gemini through an actual deployed worker was not tested.
Storage checksum/binding behavior, Redis delivery, database lifecycle and provider
interoperability were tested separately. Issuer lookup, cryptographic PDF signature
validation, guaranteed genuine/forged classification, approved certificate/level
equivalence and frontend/mobile screens are outside this backend capability.

Constitution principles 1–8: **Pass for local scope**, supported by source checks
and the tests above. Production/provider operations and broader quality evaluation
remain **Pending**. No constitutional exception was introduced.
