# Advisory AI analysis of skill evidence

Date: 2026-10-23. Scope: backend API only. Validation: [local evidence](verification-ai-validation.md).
This amendment preserves SRS V1.6
BR-04 and VER-001..007: Staff/Admin decide; AI never changes evidence approval,
reviewer, verification decision, badge or reputation. It does not determine that a
certificate is genuine. This is an extension to the existing Skills feature.

## Behavior

When `VERIFICATION_AI_ENABLED=true`, submission creates a private
`VerificationAiAnalysis` snapshot, a reference-only outbox event and request audit
in the same PostgreSQL transaction as the verification/evidence bindings. Default
is disabled and does not require provider credentials. Enabling authorizes the
configured application to transmit the attached evidence and minimal snapshot to
Google; review the provider's paid-tier data terms before enabling in an environment.

Snapshot uses the current user's self-declared full name, catalog name/description,
Sharing Skill description/level, verification/Sharing Skill versions, evidence IDs,
bindings/checksums, MIME and size. Users and Sharing Skills remain the authoritative
owners; application contracts supply these fields. Gemini receives the name, skill,
current evaluation date, evidence ID/title/description/MIME and file bytes. It does
not receive email, authentication credentials, storage keys, signed URLs, account
balances, chat or unrelated profile data. `reviewPolicy=null` because certificate
equivalence, pass thresholds and age acceptance policies are not approved rules.

Images (JPEG, PNG, WEBP) and PDF are supported, 1–5 files per submission, existing
10,000,000-byte/file maximum. Analysis uses one provider request per file, processed
sequentially to bound memory/request size. A countTokens call bounds input before
generation; generation has an output cap and shares a timeout with counting.
DOC/DOCX batches are recorded as UNSUPPORTED, with no provider call; Staff can
still use the existing manual review workflow. Mixed supported/unsupported batches
are not partially recommended. There is no conversion service in this release.

## AI result contract

Each `result.files` element contains:

- `evidenceId`, `documentType`, `languages`, `readability`.
- `extractedFields`: holderName, documentTitle, issuer, certificateNumber,
  examinationDate, issuedAt, expiresAt, result. Dates are ISO YYYY-MM-DD or null.
- `dateSources`: source page/quote for each non-null date; null otherwise.
- `nameMatch`: MATCH / PARTIAL / MISMATCH / UNKNOWN / NOT_APPLICABLE.
- `skillRelevance`: RELEVANT / PARTIAL / NOT_RELEVANT / UNKNOWN.
- `levelAssessment=UNKNOWN`: no implicit certificate-to-level equivalence.
- `issuerVerification=UNVERIFIED`: there is no issuer database or digital-signature
  validation integration. QR/URL content is not fetched.
- `tamperingAssessment`: NO_OBVIOUS_SIGNS / SUSPICIOUS / INCONCLUSIVE. This is a
  visual advisory signal, not a forgery verdict. Clean-looking documents can be
  forged; scan artifacts can trigger false suspicions.
- `flags`, `findings` with observation/assessment/source page/quote, `summary` and
  `recommendation`: SUPPORTS_SKILL / NEEDS_REVIEW / INSUFFICIENT_EVIDENCE.

Model JSON is validated with a strict Zod schema, evidence-ID checks, date-source
checks, source page bounds for images and invariants for positive recommendations.
All files must have the same recommendation for the batch to retain it; mixed
results become NEEDS_REVIEW. The backend computes batchRecommendation/batchSummary
and token usage. JSON compliance does not prove extraction or source quotes are
correct; reviewers must consult the original. Document content and user metadata
are explicitly untrusted instructions. The adapter exposes no tools, uses a fixed
Google endpoint, refuses redirects and bounds the response body.

The provider receives a simplified shape/enum JSON Schema because Gemini rejects
some deeply nested length/regex/date constraints. The backend retains all of
those constraints in its Zod response validator; invalid output never becomes a
successful analysis.

Prompt rules incorporate observed failure cases: do not calculate expiry from a
test date or reassessment recommendation; do not treat a percentile table as the
candidate's score or pass threshold; distinguish test date from issue date; missing
applicant name means UNKNOWN. Every non-null date requires a source. Date evidence
can still be misread or hallucinated by a model; there is no automatic decision.

## HTTP API

All paths use `/api/v1`, Bearer authentication and standard success/error envelopes.

`GET /staff/verifications/{verificationId}/ai-analysis`

- Requires live `skill-verification:read` permission.
- Returns `{ enabled, latest: null | analysis }`; latest includes `isStale`.
- Analysis includes id, verificationId, status, model, promptVersion, attempts,
  createdAt, completedAt, errorCode, private applicant/skill context and result.
- Does not expose storage metadata, keys, raw provider errors or API credentials.

`POST /staff/verifications/{verificationId}/ai-analysis`

- Requires live `skill-verification:analyze` permission (seeded to Staff/Admin),
  `Idempotency-Key` and `{ "expectedVersion": 1 }` (the verification version).
- Returns 202 and a run reference/projection. Can start analysis for a pending
  legacy submission or retry after failure. Reuses an active run or successful
  matching input/model/prompt. New commands are bounded by max runs per verification.
- Missing key / invalid or unknown body fields: 400; missing authentication: 401;
  missing permission/restriction: 403; missing verification: 404; version conflict,
  already decided, archived/unavailable skill/owner, run cap: 409; disabled: 503.
- Completed idempotency replays recheck authorization and return that run's current
  state; they do not start a new run. No owner or public AI endpoints are added.

## Persistence and delivery

PostgreSQL owns snapshots, results, attempts, errors and leases in
`verification_ai_analyses`. This technical runtime model is maintained through
`runtime-support.prisma` and the runtime generator; historical catalog unchanged.
Migration `20261023000000_verification_ai` adds foreign keys, bounded attempts,
state/lease/hash constraints, history/recovery indexes and a partial unique index
allowing one QUEUED/PROCESSING analysis per verification.

State transitions:

```text
QUEUED -> PROCESSING -> SUCCEEDED | STALE | FAILED
                    -> QUEUED (retryable error, fewer than 3 attempts)
UNSUPPORTED (terminal, manual review)
PROCESSING (expired lease) -> QUEUED | FAILED
```

Outbox publisher enqueues BullMQ jobs containing only analysisId, with event-ID
deduplication and bounded exponential retries. DB claims and lease tokens fence
duplicate/late workers. Recovery runs every 30 seconds across instances using
FOR UPDATE SKIP LOCKED; stale QUEUED delivery is republished after two minutes,
expired PROCESSING leases requeue, exhausted attempts become FAILED. Recovery
state/outbox writes share one transaction. Pending events still have a registered
publisher when the feature is disabled; workers leave data unchanged and recovery
replays queued work when re-enabled. DB attempts remain the authoritative cap even
if BullMQ delivery is duplicated, stalled or recovered.

File bytes are read through Storage's policy-checked application method after
validating READY/CLEAN/binding/checksum/MIME/size, and verified again against stored
SHA-256. Provider calls are outside DB transactions. Snapshot hashes are checked
before and after analysis; edits/decisions mark results stale instead of updating
business state. Historical results remain readable and are never public. A new
profile edit can occur after the completion transaction; GET computes isStale
against current source data. Staff decisions continue to use existing version and
permission checks; they never depend on AI availability.

## Configuration and rollout

```dotenv
VERIFICATION_AI_ENABLED=false
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_MS=60000
GEMINI_MAX_INPUT_TOKENS=16000
GEMINI_MAX_OUTPUT_TOKENS=8192
VERIFICATION_AI_MAX_RUNS=3
```

Secrets stay in ignored local environment/runtime secrets, never build arguments
or tracked files. A key pasted in chat is not embedded in the application.
Limits are configurable operational caps, not business approval policies. Maximum
generation exposure is bounded per file, attempt and run; a failed/retried run may
consume provider tokens. Rate limit is 10 analysis jobs/minute per queue and worker
concurrency 1 per process; global spend still depends on enabled users/instances.
Set billing limits with the provider as appropriate for the target environment.

Rollout: apply migration using the normal release process, run identity seed to
grant the new permission, configure runtime credentials/limits, then enable and
restart API/workers. Existing pending submissions are not bulk-uploaded; Staff can
request analysis individually. Disabling stops new automatic/manual analysis and
provider calls for newly started jobs; an in-flight call can complete. No deploy,
production migration, issuer account setup or frontend/mobile change is included.

Rollback: disable the integration and restart. Keep additive tables/history;
manual verification still works. Do not drop analysis or audit data as rollback.

## Constitution check

| Principle                  | Design / verification                                               |
| -------------------------- | ------------------------------------------------------------------- |
| 1 modular boundaries       | Verifications owns analysis; provider/HTTP/repository separated.    |
| 2 authoritative stores     | PostgreSQL owns snapshots/results; Redis/BullMQ is delivery only.   |
| 3 atomic relational writes | Submission/run/audit/outbox atomic; no financial changes.           |
| 4 authorization/privacy    | Live permissions, private read endpoints, minimal provider context. |
| 5 validation/contracts     | Validated env, strict model JSON, Swagger, UTC.                     |
| 6 tests                    | See validation report for checks actually executed.                 |
| 7 module ownership         | Users/Sharing Skills application contracts, Storage read policy.    |
| 8 delivery                 | Leases, duplicate protection, retry caps, outbox and recovery.      |

No architecture exceptions. Unresolved: issuer lookup access, digital-signature
validation, certificate equivalence/age policy, extraction quality calibration,
retention/deletion lifecycle for AI snapshots and broader fraud detection evaluation.
Do not describe these as implemented. Local checks for principles 1–8 are Pass;
production activation and quality calibration are Pending. See the linked validation report.

References: [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output),
[token counting](https://ai.google.dev/api/tokens),
[PDF input](https://ai.google.dev/gemini-api/docs/document-processing).
