# Tasks: mobile auth and account shell

## Status convention

Reviewed against source on 2026-10-08. Checked implementation tasks mean the
code exists; they do not establish live API or native-device acceptance.
Partial tasks remain unchecked. See `validation.md` for evidence and gaps.

## Temporary checkpoint

- [x] Review the UI-only recovery split and rerun mobile automated checks.
- [x] Update plan with implemented libraries, temporary recovery behavior and release blockers.
- [x] Document backend recovery verification handoff without changing backend code.
- [ ] Accept the full auth/account feature for release (live API/native checks and hardening remain open).

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
- [ ] Add focused infrastructure/provider tests (five HTTP/session unit tests exist; provider and storage coverage is missing).

## Phase 2: login and account shell

- [x] Add typed auth and own-account API adapters.
- [x] Replace demo login with the real login mutation.
- [x] Load `GET /api/v1/me` after login/bootstrap.
- [x] Gate authenticated routes without a login-screen flash (implemented; native verification remains pending).
- [x] Adapt AppHeader, AccountMenu and Profile consumers to OwnIdentity.
- [x] Implement current-session logout.
- [ ] Implement logout-all (endpoint and local cleanup exist; pending/error handling is missing).
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
- [x] Split email, OTP entry and new-password screens using the existing API; keep the recovery draft in memory and defer standalone backend OTP verification.
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

## Deferred backend handoff and next integration

- [ ] BE: publish recovery-only OTP verification and reset authorization contracts, including expiry, single use, resend invalidation and error/rate-limit behavior.
- [ ] BE: implement and test the approved recovery contract, mail delivery and final reset/session revocation. Backend work is explicitly deferred, not implemented here.
- [ ] Mobile: add typed API adapter and TanStack mutation after BE publishes the contract.
- [ ] Mobile: replace format-only OTP Continue with real verification; retain reset authorization only in memory.
- [ ] Mobile: adapt final reset payload and invalid/expired proof recovery to the approved contract.
- [ ] Add real API happy-path and expired/wrong/replayed OTP/proof acceptance tests.
- [ ] Verify recovery and registration keyboard, OTP autofill and navigation on Android/iOS.

## Review follow-ups

- [ ] Prevent in-flight protected requests from retrying or expiring a different session after an account switch.
- [x] Prevent profile edits made during a save from being discarded by the success redirect.
- [x] Forward the React Hook Form field ref through `ControlledInput` for error focus.
- [ ] Align architecture documentation with Axios, React Hook Form/Zod and the implemented account hooks; update stale demo-only README/API descriptions.
