# Mobile API contracts

## Current contract status

Mobile authentication consumes the identity API and uses a real account session. Backend
identity v1 is implemented and documented in
`services/api/specs/002-user-identity/contracts/http.md`. Mobile consumes it as
an external contract and must not import backend source or modify backend code
unless the user explicitly requests backend work.

Profile/public profile follows [spec 003](../specs/003-profile-public-profile/spec.md).
Own editing retains the existing `PATCH /me/profile` integration. Self-preview
projects the real own profile; other public targets and their skill lists remain
fixtures pending API integration. No public-profile API calls are introduced here.

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

## Remaining contract gaps

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
- Exact payment status polling contract after redirect.
- Exact upload limits and MIME policy for evidence, chat attachments and materials.
- Exact LiveKit token endpoint and join-window behavior.
- Exact material purchase and entitlement endpoints.
