# Tasks: mobile auth and account shell

## Planning

- [x] Create `feat/mobile-auth-account-shell` from current `origin/dev`.
- [x] Inspect the implemented backend identity contract.
- [x] Define scope, security decisions and migration phases.
- [x] Record Google OAuth and administrative account controls as out of scope.
- [ ] Review and accept this plan before broad implementation.

## Phase 1: infrastructure and bootstrap

- [ ] Add Expo SecureStore and TanStack Query dependencies.
- [ ] Add validated mobile runtime configuration.
- [ ] Implement standard response parsing and `AppError` normalization.
- [ ] Implement the shared fetch client.
- [ ] Implement secure refresh-token storage.
- [ ] Implement serialized refresh rotation.
- [ ] Add QueryProvider and AuthSession provider.
- [ ] Add the root session bootstrap gate.
- [ ] Add focused infrastructure/provider tests.

## Phase 2: login and account shell

- [ ] Add typed auth and own-account API adapters.
- [ ] Replace demo login with the real login mutation.
- [ ] Load `GET /api/v1/me` after login/bootstrap.
- [ ] Gate authenticated routes without a login-screen flash.
- [ ] Adapt AppHeader, AccountMenu and Profile consumers to OwnIdentity.
- [ ] Implement current-session logout.
- [ ] Implement logout-all.
- [ ] Implement offline/retry and expired-session UI.

## Phase 3: registration and verification

- [ ] Submit the current form with backend field names.
- [ ] Add verify-email route and screen.
- [ ] Add OTP resend behavior.
- [ ] Preserve neutral registration/resend responses.
- [ ] Return verified users to login with email prefilled.

## Phase 4: password recovery

- [ ] Add forgot-password route and screen.
- [ ] Add reset-password route and screen.
- [ ] Preserve neutral forgot-password behavior.
- [ ] Return reset users to login without auto-login.

## Phase 5: profile migration and hardening

- [ ] Wire editable own-profile fields to the backend.
- [ ] Remove `MockSessionProvider` and demo session fixtures.
- [ ] Remove fake Google session entry points.
- [ ] Add auth/account integration coverage.
- [ ] Run mobile type, lint, structure and test checks.
- [ ] Validate happy paths and recovery paths against a local API.
- [ ] Record final evidence in `validation.md`.
