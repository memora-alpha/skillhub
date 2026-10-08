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
5. Missing or rejected refresh credentials resolve to guest state. A transport
   failure with a stored credential shows a retry state instead of silently
   treating the user as logged out.

### Renewal and logout

1. Only one refresh request may run at a time because the backend has strict
   refresh rotation and no replay grace period.
2. Requests waiting on renewal reuse the same promise and retry at most once
   with the new access token.
3. Refresh failure clears local credentials and moves to the login screen.
4. Current-session logout calls `/auth/logout` with the refresh token and clears
   local state even when the neutral revoke request cannot confirm a body.
5. Logout-all calls the protected endpoint, then clears the local session.

### Password recovery

1. Forgot-password submits only email and always displays the neutral `202`
   acknowledgment.
2. The code-entry screen shows the email read-only, the shared six-cell OTP
   control and a 60-second resend countdown. Resend calls `/auth/password/forgot`,
   not the registration resend endpoint.
3. Continue checks only six-digit format, retains the email/code in an in-memory
   draft and opens a separate new-password/confirmation screen. It is not server
   verification; no verified state or success toast is shown at this step.
4. Final submission sends the draft email/code together with the password fields
   to the existing `/auth/password/reset`. Invalid/expired OTP returns to code
   entry; other failures retain the password draft for retry.
5. Successful `204` clears the recovery draft and returns to login without
   automatically authenticating. Leaving recovery also clears the draft; app
   restarts/deep links without the draft return to the email step. OTP is never
   passed in a URL or stored persistently.
6. TODO: replace code collection with standalone backend recovery verification
   and reset authorization once that contract is supplied. Backend changes are
   explicitly deferred for this UI-only split.

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

## Acceptance criteria

- A new user can register, verify and log in against the configured API.
- A returning user with a valid stored refresh token reaches the signed-in shell
  without seeing the login screen flash.
- Concurrent protected requests cause at most one refresh call.
- An invalid/replayed/expired refresh token clears the local session once.
- Network failure during bootstrap offers retry and preserves the stored token.
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
