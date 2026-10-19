# Mobile API contracts

**Current Wallet/Payment source checkpoint — 2026-10-19:** Ordinary native Top-up/Payment routes now bind the shared authenticated client, durable recovery store, explicit create/same-key replay, QR presentation and bounded foreground status reads. Independent owner status reads are enabled on native/web; web create/recovery remains unavailable. Navigation and lifecycle do not create/replay payments. Confirmed PAID results refresh Wallet/History separately without client crediting. See [ordinary native integration](../specs/006-wallet-payment-history/contracts/normal-payment-integration.md) and [validation](../specs/006-wallet-payment-history/validation.md). Deployment/API/payOS and native-device acceptance remain unverified. Older checkpoints below describe their historical scope, not the current capability flags.

**Historical QA checkpoint — 2026-10-18, BE7fc0f83 / HEAD5101aea + working tree:** Spec006 now integrates required payment recovery metadata, owner policy/status reads and native store/explicit create/replay/review/QR/status through a private QA entry. Normal Payment/Confirm stays disabled. Source/fixture/web and JS bundle checks are recorded in spec006/validation; actual deployment/API/payOS/Android/iOS acceptance remains unverified. Earlier source-missing notes are historical; no proposed API is treated as implemented.

**Historical Wallet/Payment replan — 2026-10-18:** Source7fc0f83/HEAD5101aea now implements authenticated GET /payments/creation-policy, Payment creation-identity fallback, pause/channel/REVIEW guards and required recoveryRequired/recoveryReason DTO fields. See [source/contract audit](../specs/006-wallet-payment-history/contracts/backend-review-7fc0f83.md). D1 source-sync is cleared with explicit unsupported total-loss/support boundary. Mobile owner status/list transport and QR preview exist, but recovery fields are not yet projected and native durable create/store/QA binding remain pending; normal Payment/Confirm stay off. Older checkpoints below retain historical scope. No date filter, backend mutation or activation is added.

## Payment backend contract replan — 2026-10-17

At checkout `4121c3f`, backend Payment `081b3d2` (merge `f80ef7a`) adds authenticated
POST/list/detail `/api/v1/payments`, persisted quote/nullable raw QR, REVIEW/numeric
version, retained same-key/body replay, signed receipts and atomic TOP_UP posting.
Actual request/response and source anchors are in
[spec006 Payment HTTP](../specs/006-wallet-payment-history/contracts/payment-http.md).
There is no standalone quote/policy or GET-by-key endpoint. Same-version checkout
may become null due to server read-time expiry; it does not establish EXPIRED.

Current mobile Payment is still preparation only, with every Payment capability
and real Confirm/status unavailable. New wire integration must add REVIEW and
version-aware observation, independent known-ID reads and recovery/QR gates.
GAP-06 retention/lost-correlation/mobile restart policy and QR-01 renderer/decoder
remain open. Source/mocked-provider evidence does not establish deployed API,
merchant or native acceptance. Existing Wallet/history contracts are unchanged.

## Historical Payment status preparation checkpoint — 2026-10-17

Spec006 P5 implements injected local owner-observation/related-refresh models
and labeled preview only. Normal status is unavailable and ignores URL outcome,
amount and provider claims. At the old17e3ac1 baseline no operational Payment
endpoint/freshness contract existed; mobile still has no live Payment DTO/HTTP
hook. These local preparation models retain the
previous result stale; denial evicts it; PAID survives independent refresh errors.
Owner reads/P4 remain unchanged and all Payment capabilities stay off.
Source/model/web checks are separate from actual API/payOS/native acceptance;
see [validation](../specs/006-wallet-payment-history/validation.md).

## Wallet/History checkpoint — 2026-10-17

Spec006 P2 integrates authenticated `GET /me/wallet` through the existing client.
The strict projection is `availableCredit`, `heldCredit` (exact two-decimal Credit
strings, already CR) and safe nonnegative integer `walletVersion`. Successful
authorized absent-wallet reads may return virtualzero; missing/malformed/error
responses never supply a zero fallback. Home and overview share one owner/session
query;403/404 evicts the money, and hidden screens do not keep financial reads
active behind preview. Other Home learning content retains its existing mocks.
P3 also integrates owner History/detail GETs. List sendslimit20 with only
type/referenceType/cursor, retaining returned order and rebuilding snapshot
continuations on refresh. Shared page parser stays max50. Detail validates UUID
and returned identity; all five monetary strings remain exact.403/404 evicts
private projections, with no cached-list detail fallback or inferred related
destination. The three confirmed read capabilities are enabled on focused
current-owner screens; all Payment operations remain unavailable. Source/fixture/web checks do not establish
deployed migration/API, payOS or native acceptance; see
[spec006 validation](../specs/006-wallet-payment-history/validation.md).

P4 adds only approved-policy amount/review and session-owned inert intent/QR
presentation models. Normal Confirm and all Payment capabilities stay off;
there is no mobile live Payment DTO/adapter or durable correlation implementation.
Replay opt-out is tested with an in-memory adapter at the existing `/me` read
path, without Payment traffic. Synthetic preview models cannot access account
queries. QR rendering/independent decode remain BLOCKED by QR-01; passing
model/web checks does not establish API/payOS/Android/iOS acceptance.

## Current contract status

Mobile authentication consumes the identity API and uses a real account session. Backend
identity v1 is implemented and documented in
`services/api/specs/002-user-identity/contracts/http.md`. Mobile consumes it as
an external contract and must not import backend source or modify backend code
unless the user explicitly requests backend work.

Profile/public profile follows [spec 003](../specs/003-profile-public-profile/spec.md).
Own editing retains the existing `PATCH /me/profile` integration. Self-preview
projects the real own profile; other public targets and their skill lists remain
fixtures pending API integration. The self skill list now uses the public skills
projection in [spec 004](../specs/004-skills-management/spec.md); other public
targets retain the fixture boundary.

## Profile contract checkpoint — 2026-10-09

All routes below use `/api/v1`; existing Auth/session handling remains shared.

| Flow                              | Current mobile behavior                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| GET `/me`                         | Reads own identity and nested `data.profile` through Auth spec 002.                                                    |
| PATCH `/me/profile`               | Editor sends `fullName`, `headline`, `bio`; response profile is directly in `data`. Empty headline/bio clears content. |
| Public self-preview               | Projects saved own-account fields through an explicit allowlist; no extra API call.                                    |
| Other public targets              | Fixtures only. Backend `/profiles/:userId` exists but is not integrated in mobile.                                     |
| Sharing skills                    | Own/self lists use skills APIs (spec 004); other-target profiles remain fixtures. Public rows open public-only detail. |
| POST `/me/avatar`                 | Save selected image using multipart field `image`; 202 returns `assetId`/`QUARANTINED`. JPG/PNG/WebP ≤5MB.             |
| GET `/me/avatar/uploads/:assetId` | Poll by session generation; only CLEAN triggers own-account refresh. REJECTED/DELETED do not publish the draft.        |
| DELETE `/me/avatar`               | Save removal draft; 204 has no body. Clear own avatar and pending tracking.                                            |

`completedSessionCount` means completed sessions, not Learning Paths; it is kept
in the existing adapter but hidden from profile UI after the SRS 1.6 audit. The
SRS `completedLearningPathCount` needs its own contract; no label-only substitution.
Wallet/achievement notices show no demo balances or invented badges. Title,
website and rating are not available profile fields in the current mobile contract.
Avatar selection/upload/status/removal is integrated in spec 003. Backend spec FR-009
requires automatic content validation and malware scan before replacement, without
Staff approval. SRS PRO-004 separately allows Staff moderation after a violation.
The earlier real upload stayed QUARANTINED. Local ClamAV has since started and
passed PING/INSTREAM with a repo image; the full real API CLEAN journey still needs
verification. Timezone/locale setup remains outside spec 003. Backend bio
sanitization still needs verification; native text rendering does not establish it.
See GAP-01..07 in [spec 003](../specs/003-profile-public-profile/spec.md).

## Account settings

`/account-settings` and `/account-details` require authentication. Account data
uses the existing GET `/me` (`email`, `emailVerified`, `accountStatus`, profile).
Signed-in password recovery uses the existing POST `/auth/password/forgot`,
POST `/auth/password/verify-otp` and POST `/auth/password/reset`, with the current
email fixed in the form. Reset proof stays in memory. Successful reset clears
local credentials; failed reset preserves the session and draft. Pending reset
is deduplicated and old-generation completion cannot expire a new session.
POST `/auth/logout-all` remains the only all-device action, with confirmation.
No device-list, email-change, notification preference or account-deletion API is added.

## Response envelope

Backend README currently describes the API response envelope:

```ts
type ApiSuccess<TData, TMeta = unknown> = {
  success: true;
  message: string;
  data: TData;
  meta?: TMeta;
};

type ApiFailure = {
  success: false;
  message: string;
  statusCode: number;
  details?: unknown;
};
```

Keep mobile parsing tolerant while still typed. If the backend contract differs, update this file and the relevant feature spec before implementation.

## HTTP client rules

- Create one HTTP client in `src/lib/http/client.ts`.
- Read base URL from `src/config/env.ts`.
- Attach auth tokens through one interceptor or wrapper.
- Normalize backend errors into an app error model.
- Bind protected requests, renewal, retries and response handling to the session
  generation captured at request start. Discard stale responses after account
  changes; never replay an old mutation with a new account's credentials or
  expire the new account because of an old request's failure.
- Do not log Authorization headers, OTP, password, payment payloads, private evidence URLs or LiveKit tokens.
- Do not create feature-local axios instances.

## Auth and account shell contract

Use only versioned `/api/v1` routes:

- `POST /auth/register`, `/auth/verification/resend` return neutral `202`.
- `POST /auth/verification/verify` returns bodyless `204`.
- `POST /auth/login`, `/auth/refresh` return `TokenPair` in `data` with
  `accessToken`, `refreshToken`, `tokenType`, `expiresIn` and
  `refreshExpiresAt`.
- `POST /auth/logout`, `/auth/logout-all`, `/auth/password/reset` return `204`.
- `POST /auth/password/forgot` returns neutral `202`.
- `POST /auth/password/verify-otp` accepts `email, otpCode` and returns
  `data: { resetToken, expiresAt }` with `200`.
- `POST /auth/password/reset` accepts `email, resetToken, newPassword,
confirmNewPassword`; it no longer accepts `otpCode`.
- `GET /me` returns account state and the own-profile projection.
- `PATCH /me/profile` accepts only `fullName`, `headline`, `bio`, `timezone`
  and `locale`.

Registration uses `fullName`, not the current demo form's `name`. Verification
and reset OTP values are exactly six digits. Protected calls use Bearer access
tokens. Refresh tokens are rotated strictly and must be serialized by the
client; there is no replay grace period.

Mobile stores refresh credentials in Expo SecureStore, keeps access tokens in
memory and never logs credential payloads. See
`specs/002-auth-account-shell/spec.md` for the mobile flow.

## Redis OTP contract (2026-10-08)

- Registration stages an encrypted draft in Redis; no account exists until
  `/auth/verification/verify` succeeds. Registration OTP/draft TTL is 5 minutes;
  after expiry the user must register again. Resend cannot restore an expired draft.
- Recovery uses `/auth/password/forgot` for initial and repeat code requests.
  `/auth/password/verify-otp` verifies the six-digit code before opening the
  new-password screen. Keep its one-use `resetToken` and `expiresAt` in memory.
  `/auth/password/reset` consumes that token, returns bodyless `204`, revokes
  sessions and preserves account status. Verification alone changes no password.
  A replacement OTP invalidates older reset tokens. Missing, expired or rejected
  reset tokens return to the email step to request a new code, not the consumed OTP.
- Both purposes enforce a 60-second resend cooldown and at most five code issues
  per UTC hour per email/purpose. Neutral `202` only acknowledges the request;
  it does not prove an email was delivered or a new code issued.
- Five wrong codes across purposes/challenges temporarily block OTP for the
  normalized email for 24 hours. Resend does not reset this counter. This is
  not an account lock and must not disable ordinary password login in the client.
- Invalid, expired, consumed, replaced and blocked codes share
  `400 OTP_INVALID_OR_EXPIRED`. No remaining-attempt or unblock timestamp is
  exposed. Mobile shows conditional guidance and does not invent a ban countdown
  or infer a lock from five local API errors; failures may originate on other devices.
- Reset may commit before Redis cleanup or password-change email enqueue fails.
  On network/5xx failure, mobile preserves input and offers login with the email
  prefilled; the new password may already be effective. It does not retry automatically.

## Skills contract checkpoint — 2026-10-09

[Spec 004](../specs/004-skills-management/spec.md) covers own management and
verification. The backend contract in
[skills HTTP](../../../services/api/specs/007-skills/contracts/http.md) still has
a planned heading; controllers/DTO/services/repositories were checked read-only.
Mobile now connects owner CRUD, public self skills and evidence/history/download
to these routes through `features/skills`. Browser fixtures and transport tests
pass; the full real API/storage/scanner journey remains pending.

| Route (base `/api/v1`)                                         | Current source contract                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| GET `/skills`, `/skills/:skillId`                              | Public ACTIVE catalog, q2–100/categoryId/cursor/limit for list.                                         |
| GET `/me/skills`                                               | Owner list, includeArchived default false; true includes all, not only archived.                        |
| GET `/skills/:skillId/levels`                                  | ACTIVE per-skill levels; nonpaginated array ordered by sortOrder then id.                               |
| POST `/me/skills`                                              | skillId, levelId, description20–1500, experienceYears decimal string/null, isVisible default true; 201. |
| PATCH `/me/skills/:sharingSkillId`                             | Changed editable fields + expectedVersion; no skillId; 200.                                             |
| POST `/me/skills/:sharingSkillId/archive`                      | expectedVersion; pending batch blocks archive with 409; 200.                                            |
| GET `/profiles/:userId/skills`                                 | Public projection, visible/nonarchived/ACTIVE account and catalog; spec 004 uses self UUID.             |
| POST `/me/skills/:sharingSkillId/evidence-files`               | One multipart field file; 202 with fileId/state QUARANTINED.                                            |
| GET `/me/skills/:sharingSkillId/evidence-files/:fileId`        | Storage state; READY is required for submission.                                                        |
| POST `/me/skills/:sharingSkillId/verifications`                | 1–5 distinct fileIds, title0–120?, description0–500?; 201 PENDING batch.                                |
| GET `/me/skills/:sharingSkillId/verifications`                 | Owner history, cursor/limit.                                                                            |
| GET `/me/skills/:sharingSkillId/verifications/:verificationId` | Owner batch detail with evidence metadata/reasons.                                                      |
| GET `/me/skills/:sharingSkillId/evidence/:evidenceId/download` | Owner authorized short-lived url/expiresAt; file must be READY.                                         |

JSON mutations require `Idempotency-Key`; edit/archive also need expectedVersion.
Mobile labels archive as "Xóa kỹ năng" and always reads own list/detail with
`includeArchived=false`. A confirmed archived DTO removes its ID from visible
lists, detail/history caches and local evidence drafts. Deleted records stay on
the server for history; mobile has no archived-list toggle or read-only view.
Same operation/body retry keeps the key; changed body/version uses a new intent.
Multipart upload is not idempotent replay: retry may create a new fileId.
The user's Save action on a new skill creates the record and queues a session-owned
evidence transfer, returning to My Skills as soon as skill creation is confirmed.
The task uploads selected evidence, checks READY, then submits the JSON batch.
Failure updates the card and shows an error toast without undoing the saved skill.
With no files it only creates
the skill. Unconfirmed create/update stays on the form. Existing-skill verification
uses the separate Send action. There is no separate upload button. Partial
failures retain drafts and returned file IDs in the session; reopen the skill to
explicitly retry. Submit intent/key survives leaving and reopening the screen;
explicit retry checks and reuses returned file IDs. Scan
checks are bounded and continue across route blur; app background pauses them,
and session change discards them. Separate Send queues the task and returns to
skill detail immediately. Confirmed batch submission updates owner/history caches
and shows its own success toast. Read refresh starts in the background after the confirmed
write is recorded, so slow reads do not prolong the save. This changes client flow,
not the endpoints or server verification policy.
Two workers each prepare a file and upload it before taking the next file;
in-flight uploads settle before failure releases the retry lock, preserving IDs.
Status reads then run together for at most five files. Active Send polls
immediately, with 0.5/1/2/3-second waits initially and 5-second waits after the
24th read, capped at 48 reads/file (183.5 seconds of waits, excluding HTTP time).
After 24 pending reads the card explains that checking is taking longer.
Exhaustion with QUARANTINED/SCANNING retains an informational WAITING_SCAN state
and Check again action. Explicit retry rechecks IDs without uploading them again;
only READY files can submit. Terminal failures cancel sibling waits and remain
errors. No mutation automatically resumes after pause.
Own cards show preparation/upload/checking/submission progress with a spinner,
waiting for scan, confirmed pending approval, or failed/Retry;
the card detail remains reachable and VERIFIED stays independent.
Session-only jobs/drafts do not promise execution or restoration after app closure.
Images over 2 MB are optionally re-encoded to JPEG quality 0.9 using SDK 57
ImageManipulator, without resizing/cropping. A smaller validated output updates
the upload URI/name/MIME/size consistently; encoder failures or larger outputs
retain the original. Already-uploaded IDs and PDF/Word are never re-encoded.
Owner can keep the original before upload. All files still require READY and
the server's cap; private original/compressed assets stay out of public projections.
The confirmed submit DTO is retained in session-scoped owner/history caches before
refresh, so failed reads do not remove the saved request or enable duplicate Send.
Owner history includes files; image previews obtain fresh authorized download URLs
and retain them only in component state until blur/background/expiry. No preview
URL is projected onto public profiles. The Pending filter uses latestVerification
in addition to the aggregate badge; it adds no API parameter or backend field.
Mobile HTTP now exposes `idempotencyKey` and `requestPage`, sharing the existing
session/renewal pipeline. Ordinary `request` still returns only data for
Auth/account/avatar. Evidence upload renews credentials after 401 but requires
explicit retry instead of replaying bytes; avatar behavior remains compatible.

List envelope uses `data: []` and `meta.pagination: {limit,hasMore,nextCursor}`;
limit1–50/default20, cursor opaque and bound to filters. Do not read pagination
from data or infer completeness from item count. Own Sharing Skill includes nested
skill, isVisible, archivedAt, version and latestVerification. The latter is raw
batch metadata, not a full detail response with files. Public projection excludes
owner metadata/reasons/evidence. Map fields with an explicit allowlist.
Public detail at `/public-skills/:userId/:sharingSkillId` walks the target user's
public skill pages, including later pages, because no public Sharing Skill detail
endpoint exists. It displays only name, level, full description, experienceYears
and verificationStatus. It never calls own/history/evidence/download endpoints,
even for self-preview; unavailable/hidden/deleted/wrong-owner IDs do not fall back
to owner caches. Confirmed hide/archive clears matching public detail caches.
Other-profile fixtures open sample detail with their existing public fields,
without adding real profile API integration or invented missing descriptions.

Evidence cap follows config with a current hard ceiling of 10,000,000 bytes/file;
the client has no config endpoint and must handle stricter server 413/503 results.
Allowed formats are PDF/DOC/DOCX/JPG/JPEG/PNG/WEBP; no avatar/chat policy reuse.
My Skills keeps confirmed creates newest first within the current session, merges
them with loaded owner pages, and retains their latest known server version when
refresh fails or a UUID-ordered page omits the new record. Edits do not change
creation order. The current owner projection does not expose createdAt or sorting;
full historical newest-first pagination remains a backend dependency (GAP-09).

Batch PENDING/APPROVED/REJECTED and evidence PENDING/APPROVED/REJECTED/REVOKED
are distinct from the four-value Sharing Skill badge. New batches can coexist
with a VERIFIED badge when older approved evidence remains.

Evidence history/detail reads submittedAt/reviewedAt from the server's absolute
ISO timestamp and renders explicitly in Asia/Ho_Chi_Minh with a Vietnam-time
label. It never adds/removes seven hours from the instant or sends a client save
time in upload/submit payloads. The current evidence projection omits uploadedAt;
the displayed submission time belongs to the verification batch, not a file's
upload time. Masked HTTP 503 shows a generic server-unavailable message rather
than inventing a storage/scan/timezone diagnosis. The UTC Prisma connection fix
is owned by the backend, authorized separately by the user on 2026-10-13.

Backend recheck (2026-10-12): `POST /me/skills/:sharingSkillId/restore` exists with
its own permission, expectedVersion and Idempotency-Key. Restore remains outside
mobile spec 004; the delete confirmation describes removal and retained history.
There is still no owner skill-detail endpoint, so detail walks the active owner list.

Create/edit/visibility responses now update the scoped detail and already-loaded
owner lists before refresh. Pagination metadata stays unchanged; replay cannot
replace a newer cached version. Public updates use an allowlist and only replace
already-public rows; hidden/inactive/archived rows are removed. Mobile does not
invent public membership or profile counters when a refresh fails.
History/detail decisions clear only a matching submitted snapshot with an equal
or newer version, then refetch the owner/public/account projections. A decision
alone does not supply the aggregate badge or Sharing Skill version.
Web multipart normalizes empty/generic picker MIME to the validated format while
preserving the bytes and filename. Filename checks follow the backend's rejection
of empty basenames and unsafe earlier extensions, such as `proof.exe.pdf`.

Known differences/gaps: public
repository filters catalog ACTIVE although HTTP markdown mentions historical
INACTIVE public display; SRS material-change verification policy is not implemented
as an edit reset in the current service. Record these differences rather than
creating mobile policy/endpoints. See GAP-01..08 in spec 004.

## Remaining contract gaps

### Per-skill level catalog — 2026-10-14

Backend source and its [catalog amendment](../../../services/api/specs/007-skills/skill-level-catalog.md)
replace fixed Sharing Skill levels with Admin-managed catalog selections. The
level lookup returns a success envelope with `data: []` and no pagination. Mobile
validates IDs/parent skill, displays ACTIVE choices in server order and sends
only `levelId` for creation or a changed selection. PATCH omits levelId when
preserving an existing selection, including a now-INACTIVE level.

Own/public skill projections accept open-string `level`, nullable `levelId` and
`skillLevel`. Display uses the catalog name and optional description; nested
metadata is allowlisted. Legacy null/absent metadata keeps the old display label.
Changing the skill clears its selected level; failed/empty reads do not supply
the former four choices. Query keys retain session and skill scope.

Learning Request offered-skill and own offering-option projections also accept
custom codes and render `skillLevel.name`. Their parser forwards only the level
name needed for display. Request `currentLevel` retains its independent learning
progress enum. Fixture checks and native/real-API acceptance remain separate.

### Learning Request checkpoint — 2026-10-11

[Spec 005](../specs/005-learning-request/spec.md) covers own requests,
create/publish/edit/cancel, discovery/search and owner moderation status/reason. The
[contract checkpoint](../specs/005-learning-request/contracts.md) records verified
routes, payloads, projections, versions, expiry and runtime dependencies at
`dev` commit `c52ec74`. Mobile now calls the API for own list/detail, draft create,
edit, publish/cancel, feed/recommended and Skill lookup. Shared schemas strip
fields outside the projection; pagination keeps `meta.pagination`. UI tests use
an isolated fixture API; LR backend acceptance remains open. See
[validation](../specs/005-learning-request/validation.md).

Backend LR still wires Catalog, public owner, Path/Schedule lock and Sharing Skill
readers to adapters returning 503. The separate Skill HTTP API does not establish
LR runtime readiness. Tag lookup is an open contract gap. Real request IDs must
not enter the existing mock Proposal/Chat flow, and API failures must not fall back
to demo data. Tag selection/filtering remains deferred; existing owner tag IDs
are preserved on edit and public tag labels are rendered from the API. See
GAP-01..08 and [tasks](../specs/005-learning-request/tasks.md).

UI correction2026-10-12 adds weekday/time availability as a form draft. The API
still accepts only dated preferredSlots; weekly save is blocked pending B08/GAP-09.
Confirm the actual timezone/weekly contract before T036 integration. See
[resume checkpoint](../specs/005-learning-request/resume.md).

Notification inbox, mark-read and notification deep links belong to a separate
spec. Spec 005 retains Notification as DEP-01 for the SRS rejection-notification
requirement; it does not integrate notification APIs or claim full FR-LR-04
end-to-end acceptance.

### Proposal UI boundary

Proposal list, detail, sent-proposal editing, rejection with a reason and withdrawal
are local fixtures. No Proposal HTTP routes or DTOs are assumed. SRS 1.6 PP-002
allows updating/withdrawing a pending proposal; the local store allows editing only
sent `PENDING` proposals and accept/reject only received `PENDING` proposals.
Acceptance opens a local conversation and never creates a Learning Path, schedule,
Session or Credit hold. A pending proposal for the same request cannot be accepted
when another has already been accepted locally.

`localDecisionNote` is UI-only metadata based on the supplied rejection design;
it is not an assumed backend response field and is not sent to another account.
The reason form requires nonblank text up to 1000 characters as a UI constraint.
Confirm backend reason-field semantics before integrating rejection.
An `EXPIRED` fixture illustrates the read-only screen; expiry timing remains
server/config controlled and no local deadline is invented.

TODO: confirm Proposal/direct-invitation DTOs and update contract, request OPEN/
NEGOTIATING synchronization, account ACTIVE checks, verified Sharing Skill policy,
anti-spam/expiry policy, optional suggestion limits, structured future candidate
slots and exchange-specific Credit limits. Current forms keep Credit/session count
as positive suggestions and availability as display text. They do not establish
TWO_WAY/ONE_WAY agreement terms or validate final Credit/schedules.

- Google OAuth, email change and device/session management are not exposed in v1.
- Exact Learning Path, LearningPlan and Schedule DTOs for SRS 1.6.
- Exact enum values for exchange type, plan status, schedule status and report reason codes.
- Any future automatic Payment observation budget or SSE integration; current plan uses manual owner GET with QR-only flow, no redirect requirement.
- Evidence format/cap/scan source is documented above; exposure of a configured
  client cap and runtime verification remain pending. Confirm exact contracts for
  chat attachments and material uploads separately.
- Exact LiveKit token endpoint and join-window behavior.
- Exact material purchase and entitlement endpoints.

## Public profile read contract — 2026-10-13

/profiles/[userId] for another UUID uses authenticated GET /profiles/:userId.
Public fields: userId/fullName/headline/bio/avatarUrl/reputationScore/
verifiedSkillCount/completedSessionCount. Matching target ID is required; private
fields and nested sharingSkills are not forwarded. Public skills come from the
existing paginated /profiles/:userId/skills endpoint and can open their public
skill detail. Self-preview and named demo routes are preserved. Request footer
passes owner ID and requestId; Back preserves history and has a UUID request
fallback.403/404 removes the profile snapshot;503 exposes retry, with no mock
fallback. Real backend/native acceptance remains separate from fixture evidence.

## Request-context mock entry — 2026-10-13

The user's explicit request permits request detail to open the existing Proposal
mock screen. /send-proposal?mode=mock-request validates a public context snapshot,
displays that request's title/owner/skill and labels the entire form as a preview.
The local request/party IDs have preview prefixes; actual UUIDs are not sent to
Proposal/Chat APIs. API integration remains assigned to the separate Proposal
branch. Named demo entries retain their existing behavior.
