# Specification: mobile auth and account shell

## Goal

Replace the session demo boundary with a production-shaped mobile authentication
flow backed by the implemented v1 identity API, then make the signed-in shell
derive its account state from `GET /api/v1/me`.

## Scope

- Email/password registration and the required six-digit email verification.
- Verification resend with neutral responses and server-enforced cooldowns.
- Email/password login with the existing remember-me control.
- Session bootstrap, access-token renewal, current-session logout and logout-all.
- Forgot-password and OTP password-reset journeys.
- Authenticated account projection from `GET /api/v1/me`.
- Route gates and explicit bootstrapping, guest, authenticated, offline and
  expired-session states.
- Secure refresh-token persistence and in-memory access-token handling.
- Migration of the existing header, account menu, profile and edit-profile
  consumers from `MockSession` to the real account shell.
- Typed API envelopes, errors and auth/account DTOs owned by the mobile app.

## Out of scope

- Google OAuth, because the v1 backend exposes no Google authentication route.
- Email change, account deletion, suspend/deactivate controls and device/session
  management UI beyond logout-all.
- Staff/Admin user management and reauthentication.
- Avatar upload and scan status; this remains a later profile increment.
- Public profiles, skills, reputation behavior and other signed-in features.
- Any backend, database, migration or API-contract change.

## User journeys

### Registration and verification

1. A guest submits full name, normalized email, password confirmation and terms
   consent to `POST /api/v1/auth/register`.
2. A valid `202` response always opens verification without revealing whether
   the email already exists.
3. The user submits the six-digit OTP to
   `POST /api/v1/auth/verification/verify` or requests resend.
4. A successful `204` returns the user to login with the verified email
   prefilled. Verification does not create a session.
5. Invalid, expired, superseded or exhausted OTP values share the backend's
   neutral `OTP_INVALID_OR_EXPIRED` presentation.

### Login and session bootstrap

1. Login sends email, password and `rememberMe` to
   `POST /api/v1/auth/login`.
2. The access token remains in memory. The refresh token and its expiry are
   persisted in Expo SecureStore.
3. The app fetches `GET /api/v1/me` before entering the signed-in tabs.
4. On a cold start, a stored refresh token is rotated once, the replacement is
   persisted, and then the account projection is loaded.
5. Missing or rejected refresh credentials resolve to guest state. Failures
   before refresh submission offer retry. An uncertain result after submission
   retains the pending rotation marker and requires reauthentication, because
   replaying the credential could revoke the session.

### Renewal and logout

1. Only one refresh request may run at a time because the backend has strict
   refresh rotation and no replay grace period.
2. Requests waiting on renewal reuse the same promise and retry at most once
   with the new access token.
3. Rejected/expired refresh clears credentials. An ambiguous rotation outcome
   requires reauthentication without replaying the possibly consumed credential.
4. Current-session logout calls `/auth/logout` with the refresh token and clears
   local state even when the neutral revoke request cannot confirm a body.
5. Logout-all calls the protected endpoint, then clears the local session.
   Pending calls are deduplicated and actions disabled. Failures show one toast,
   retain the session and allow explicit retry. A late response cannot clear a
   newer account's session.

### Password recovery

1. Forgot-password submits only email and always displays the neutral `202`
   acknowledgment.
2. The code-entry screen shows the email read-only, the shared six-cell OTP
   control and a 60-second resend countdown. Resend calls `/auth/password/forgot`,
   not the registration resend endpoint.
3. Continue submits `email, otpCode` to `/auth/password/verify-otp`. Only a valid
   `200` response with `resetToken, expiresAt` opens the new-password screen.
   OTP errors remain on code entry and show one toast.
4. Final submission sends `email, resetToken` and password fields to
   `/auth/password/reset`. There is no action to re-enter the consumed OTP on
   this screen. Invalid/expired reset authorization restarts at the email step
   with email retained; other failures retain the password draft for retry.
5. Successful `204` clears the recovery draft and returns to login without
   automatically authenticating. Leaving recovery also clears the draft; app
   restarts/deep links without the draft return to the email step. Neither OTP
   nor resetToken is passed in a URL or stored persistently.
6. Redis OTP policy applies across registration and recovery: five wrong codes
   temporarily block OTP for the email for 24 hours; resend does not reset attempts.
   The shared error does not distinguish a blocked email from an invalid/expired
   code, so the client shows conditional guidance without a local ban counter.
7. A network/5xx reset failure may happen after the password transaction commits.
   Preserve password input and offer login with the email prefilled; do not retry
   automatically or claim the password is unchanged.

## Functional requirements

- **AAS-001:** Mobile uses only the versioned `/api/v1` identity routes.
- **AAS-002:** Registration field names match the backend contract:
  `fullName`, `email`, `password`, `confirmPassword`, `agreeTerms`.
- **AAS-003:** Auth success envelopes are parsed from `data`; `204` responses
  are accepted without JSON parsing.
- **AAS-004:** Error presentation uses root `message` and `statusCode`, with
  safe local fallbacks for malformed or network responses.
- **AAS-005:** Secrets, Authorization headers, passwords and OTP values are
  never logged or included in analytics.
- **AAS-006:** Refresh tokens are stored only through Expo SecureStore. Access
  tokens are not persisted.
- **AAS-007:** Refresh rotation is serialized across bootstrap and HTTP retry.
- **AAS-008:** The shell does not render authenticated routes until bootstrap
  has resolved.
- **AAS-009:** `ACCOUNT_NOT_ACTIVE` and invalid credentials remain distinct UI
  states without exposing account existence during neutral flows.
- **AAS-010:** Account display name, email, user ID and avatar URL come from the
  own-account projection, not demo fixtures.
- **AAS-011:** Profile updates send only editable fields and refresh/update the
  cached own-account projection.
- **AAS-012:** Existing route paths and signed-in navigation remain stable.
- **AAS-013:** Google buttons are disabled or marked unavailable until an
  approved backend OAuth contract exists; they must not enter a demo session.
- **AAS-014:** OTP request feedback is neutral; `202` does not prove delivery.
  Registration creates an account only after verification, and an expired
  five-minute registration draft requires submitting registration again.
- **AAS-015:** OTP screens explain the shared 24-hour OTP restriction without
  treating it as account LOCKED or blocking ordinary password login.
- **AAS-016:** Protected requests bind to the original session generation before
  token reads. Stale responses, retries and expiration must not affect another session.
- **AAS-017:** Logout-all guards pending actions, deduplicates concurrent calls
  and handles failures without automatic mutation retries or unhandled rejections.
- **AAS-018:** Recovery OTP must be verified by the API before new-password entry;
  reset authorization remains memory-only and is cleared after success or exit.

## Acceptance criteria

- A new user can register, verify and log in against the configured API.
- A returning user with a valid stored refresh token reaches the signed-in shell
  without seeing the login screen flash.
- Concurrent protected requests cause at most one refresh call.
- An invalid/replayed/expired refresh token clears the local session once.
- Bootstrap failures before refresh submission offer retry. Uncertain rotation
  results require reauthentication and never replay the stored token.
- Requests begun under an earlier session cannot retry with or expire a later session.
- Logout and logout-all remove local credentials and return to the public flow.
- Forgot/reset follows the backend's neutral response behavior.
- Profile/header/account menu use the authenticated `OwnIdentity` projection.
- No backend files or contracts are modified by this feature.

## Contract source

- `services/api/specs/002-user-identity/contracts/http.md`
- `services/api/src/modules/auth/presentation/http/auth.controller.ts`
- `services/api/src/modules/auth/presentation/http/auth.dto.ts`
- `services/api/src/modules/users/presentation/http/users.controller.ts`
- `services/api/src/modules/users/presentation/http/users.responses.ts`
