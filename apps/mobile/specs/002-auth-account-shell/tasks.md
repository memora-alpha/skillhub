# Tasks: mobile auth and account shell

## Status convention

Reviewed against source on 2026-10-09. Checked implementation tasks mean the
code exists; they do not establish live API or native-device acceptance.
Partial tasks remain unchecked. See `validation.md` for evidence and gaps.

## Development checkpoint

- [x] Review registration, token-based recovery and session hardening; rerun mobile checks (55 tests).
- [x] Update the specification and plan with the published recovery contract and remaining acceptance gaps.
- [x] Verify mocked registration, recovery and logout-all browser journeys.
- [ ] Accept the full auth/account feature for release (real mailbox, provider/storage and native checks remain open).

## Planning

- [x] Create `feat/mobile-auth-account-shell` from current `origin/dev`.
- [x] Inspect the implemented backend identity contract.
- [x] Define scope, security decisions and migration phases.
- [x] Record Google OAuth and administrative account controls as out of scope.
- [x] Review and accept this plan before broad implementation (user authorized implementation).

## Phase 1: infrastructure and bootstrap

- [x] Add Expo SecureStore and TanStack Query dependencies.
- [x] Add validated mobile runtime configuration.
- [x] Implement standard response parsing and `AppError` normalization.
- [x] Implement the shared Axios client (replaces fetch at the user's request).
- [x] Implement secure refresh-token storage (native; web preview is memory-only).
- [x] Implement serialized refresh rotation.
- [x] Add QueryProvider and AuthSession provider.
- [x] Add the root session bootstrap gate.
- [ ] Complete infrastructure/provider tests (HTTP/session regressions exist; provider and native storage coverage remains missing).

## Phase 2: login and account shell

- [x] Add typed auth and own-account API adapters.
- [x] Replace demo login with the real login mutation.
- [x] Load `GET /api/v1/me` after login/bootstrap.
- [x] Gate authenticated routes without a login-screen flash (implemented; native verification remains pending).
- [x] Adapt AppHeader, AccountMenu and Profile consumers to OwnIdentity.
- [x] Implement current-session logout.
- [x] Implement logout-all with pending guards, deduplication, error feedback and explicit retry.
- [x] Implement offline/retry and expired-session UI (ambiguous refresh requires reauthentication).

## Phase 3: registration and verification

- [x] Submit the current form with backend field names.
- [x] Add verify-email route and screen.
- [x] Add OTP resend behavior.
- [x] Add a 60-second resend countdown and six-cell verification input (web mock verified; native autofill remains pending).
- [x] Preserve neutral registration/resend responses.
- [x] Return verified users to login with email prefilled.

## Phase 4: password recovery

- [x] Add forgot-password route and screen.
- [x] Add reset-password route and screen.
- [x] Split email, OTP verification and new-password screens; verify with the API and keep reset authorization only in memory.
- [x] Reset with the verified token; restart expired proof from the email step without offering to re-enter a consumed OTP.
- [x] Preserve neutral forgot-password behavior.
- [x] Return reset users to login without auto-login.

## Phase 5: profile migration and hardening

- [x] Wire editable own-profile fields to the backend and guard edits during save.
- [ ] Remove `MockSessionProvider` and demo session fixtures (not used by runtime; legacy files remain).
- [x] Remove fake Google session entry points (no active Google login/register action).
- [ ] Add auth/account integration coverage.
- [x] Run mobile type, lint, structure and test checks.
- [ ] Validate happy paths and recovery paths against a local API.
- [x] Record source review, automated checks and remaining verification gaps in `validation.md`.

## Published recovery contract and acceptance

- [x] Confirm published `/password/verify-otp` and resetToken-based `/password/reset` contracts in source and local Swagger.
- [x] Add typed API adapters and TanStack mutations for the published contract.
- [x] Replace format-only OTP Continue with server verification; retain reset authorization only in memory.
- [x] Adapt final reset payload and invalid/expired proof recovery to the contract.
- [ ] Add real API happy-path and expired/wrong/replayed OTP/proof acceptance tests.
- [ ] Verify recovery and registration keyboard, OTP autofill and navigation on Android/iOS.

## Review follow-ups

- [x] Bind protected requests to the original session generation; reject stale responses and prevent retry/expiration of another session.
- [x] Prevent profile edits made during a save from being discarded by the success redirect.
- [x] Forward the React Hook Form field ref through `ControlledInput` for error focus.
- [x] Update README/API descriptions for real authentication, OTP verification and token-based recovery.
- [ ] Finish the account-hook extraction described in the target architecture (query/profile mutation still live in AuthSession).
