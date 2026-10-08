# Plan: mobile auth and account shell

## Baseline

- Branch: `feat/mobile-auth-account-shell`.
- Base: `origin/dev` at `da3de45`.
- The original planning baseline used demo auth. Auth/account runtime now uses
  identity v1; learning/calendar/chat content remains local fixtures.
- Backend identity v1 exists in source. Mobile consumes its external contract
  without backend imports; live API/device acceptance is still pending.

## Checkpoint: 2026-10-08

- Ready for a temporary development checkpoint, not production acceptance.
- Implemented: Axios transport, Query/SecureStore account shell, React Hook
  Form/Zod auth/profile forms, singleton toast feedback, keyboard-aware forms,
  read-only verification email and six-cell OTP with 60-second resend cooldown.
- Recovery UI is email -> code entry -> new password. Code entry checks only
  format; v1 verifies the code during final password/reset submission. No
  intermediate verified state is created. Backend changes are deferred by the
  user; the next integration step depends on a published recovery contract.
- Recovery email/code are memory-only Zustand state, cleared when leaving or
  succeeding. Passwords stay local to the final form. Separate registration
  and recovery cooldown timestamps follow the server's OTP purposes.
- Known release blockers: session-switch request retry/expiration race,
  logout-all pending/error handling, missing provider/storage integration tests,
  live email/API acceptance and Android/iOS keyboard/SecureStore verification.

## Decisions

- Use Axios behind one client in `src/lib/http`, as requested by the user.
- Use TanStack Query for API queries, mutations and own-account cache invalidation.
- Add Expo SecureStore for refresh-token persistence.
- Keep access tokens in memory and reconstruct sessions through refresh on app
  startup.
- Implement a single-flight refresh coordinator shared by bootstrap and HTTP
  retry. Never send the same refresh token concurrently.
- Use React Hook Form/Zod for screen-local form state and blur/change validation.
- Use Zustand only for client-only recovery drafts and cooldown timestamps;
  never mirror server account entities or persist the recovery code.
- Keep the existing public paths. Route groups may organize files only when the
  URL remains unchanged.
- Replace `MockSessionProvider` after consumers can use the new compatibility
  account view; do not maintain two competing session authorities.
- Treat Google OAuth as unavailable until the backend publishes a route.

## Target structure

```text
apps/mobile/src/
  config/
    env.ts
  lib/
    http/
      client.ts
      errors.ts
      response.ts
    storage/
      auth-token-store.ts
  providers/
    AppProviders.tsx
    QueryProvider.tsx
    ToastProvider.tsx
  components/
    ControlledInput.tsx
    KeyboardFormScrollView.tsx
    OtpInput.tsx
  features/auth/
    api/
      auth-api.ts
      auth-contracts.ts
    components/
      SessionGate.tsx
    context/
      AuthSession.tsx
    hooks/
      use-auth-actions.ts
      use-verification-cooldown.ts
    screens/
      LoginScreen.tsx
      RegisterScreen.tsx
      VerifyEmailScreen.tsx
      ForgotPasswordScreen.tsx
      ResetPasswordCodeScreen.tsx
      ResetPasswordScreen.tsx
    utils/
      validateRegistration.ts
      password-recovery-flow.ts
      verification-cooldown.ts
  features/account/
    api/
      account-api.ts
      account-contracts.ts
    hooks/
      use-account.ts
      use-update-profile.ts
  features/shell/
    components/
      AccountMenu.tsx
      AppScreenLayout.tsx
      SessionBootstrap.tsx
```

Create only the files needed by each phase. Feature consumers import through
`index.ts`; routes remain thin. Account hooks shown above remain target work:
the current query/profile mutation still live in AuthSession.tsx.

## Session model

```ts
type AuthStatus =
  "bootstrapping" | "guest" | "offline" | "reauth" | "authenticated";
```

The context exposes state plus login, logout, logout-all and retry-bootstrap.
The access token stays inside SessionController, not the UI projection.
TanStack Query owns `OwnIdentity`. A small compatibility selector maps
`OwnIdentity` to the display fields currently consumed by header/profile code
during migration.

## HTTP and renewal flow

1. `request()` resolves the configured API base URL through Axios and sends JSON unless the
   request is multipart or bodyless.
2. Protected calls read the current access token through an injected getter.
3. A protected `401` requests one serialized refresh and retries once.
4. Refresh stores the replacement credential before releasing waiting calls.
5. A second `401` or rejected refresh expires the session. An ambiguous refresh
   outcome retains the in-flight storage marker and requires reauthentication;
   do not replay a possibly consumed refresh credential. Invalid envelopes are
   normalized errors, not an unconditional instruction to clear every session.
6. `204` returns `undefined`; JSON success returns `data`; failures throw the
   normalized `AppError`.
7. The client never retries registration, verification, reset or other mutation
   failures automatically.

## Implementation phases

### Phase 1: infrastructure and bootstrap

- Add and configure TanStack Query and Expo SecureStore.
- Validate `EXPO_PUBLIC_API_URL` in `src/config/env.ts`.
- Implement response parsing, normalized errors and the shared Axios client.
- Implement the secure token store and single-flight refresh coordinator.
- Add AuthSession provider and a root bootstrap gate.
- Add unit coverage for envelope parsing, token storage adapter behavior and
  concurrent refresh serialization.

### Phase 2: login and account shell

- Wire login to the v1 endpoint and persist the returned refresh credential.
- Add the own-account API/query and adapt the header/account menu/profile shell.
- Gate `(tabs)` and signed-in detail routes from resolved auth state.
- Implement current-session logout and logout-all.
- Add loading, offline/retry and expired-session presentations.

### Phase 3: registration and email verification

- Map the existing registration form to backend field names.
- Add verify-email and resend screens/routes.
- Preserve neutral responses and OTP attempt/cooldown messaging.
- Return verified users to login with the email prefilled.

### Phase 4: password recovery

- Replace the forgot-password notice with a real request screen.
- Separate the email, code-entry and new-password screens.
- Reuse the shared six-cell input and per-purpose 60-second resend cooldown.
- Preserve neutral send acknowledgments and the existing combined reset payload.
- Keep recovery drafts memory-only; guard direct entry without a draft and return
  invalid/expired-code errors to the code screen. Other failures keep the password
  form draft for retry.
- Return to login after success without creating a session.

### Backend handoff: standalone recovery verification

Backend work is not part of this checkpoint. Publish the contract first:

- Define a recovery-only verification request and response. Registration OTP
  verification must not activate or authorize password recovery.
- Define short-lived, single-use reset authorization after a valid recovery OTP,
  including expiry, replay behavior, resend invalidation and rate/attempt limits.
- Specify the new reset request and whether the combined v1 reset flow remains
  compatible during migration. Endpoint paths and response fields are not yet
  agreed; mobile must not invent them.
- Preserve neutral public errors/acknowledgments, server password policy and
  session revocation. Include invalid/expired/replayed proof tests and actual
  mail-delivery acceptance in the backend handoff.

After the contract is published, mobile will add typed adapters/mutations, replace
format-only Continue with server verification, keep reset authorization out of
URLs/persistent storage, adapt the final submission and rerun integration tests.

### Phase 5: profile migration and hardening

- Wire own-profile edits to `PATCH /api/v1/me/profile`.
- Remove remaining demo-session dependencies from authenticated shell code.
- Add focused integration tests for bootstrap, renewal, logout and route gates.
- Verify no credential data appears in logs, errors or persisted non-secure
  storage.

## Dependency changes

- Add `expo-secure-store` through `npx expo install expo-secure-store --npm`.
- Add `@tanstack/react-query` to the mobile package.
- Use Axios, React Hook Form, Zod and @hookform/resolvers for transport/forms.
- Use react-native-toast-message for one replaceable root toast and
  react-native-keyboard-controller for native form scrolling.
- Use Zustand only for the client-only, in-memory recovery/cooldown state.
- Add a focused Expo-compatible test stack only with the first executable tests;
  do not add a framework without tests that use it.

Lockfile updates must include both `apps/mobile/package-lock.json` and the root
`pnpm-lock.yaml`, then be verified from the root workspace.

## Risks and mitigations

- **Refresh replay:** serialize rotation; require reauthentication rather than
  replaying a credential after an ambiguous outcome.
- **Session-switch race:** bind protected requests and retries/expiration to the
  original session generation before allowing account switching in production.
- **Recovery contract gap:** code entry is format-only until BE supplies a
  separate verification contract; never label it server-verified.
- **Native dependencies:** rebuild a development client with keyboard-controller
  when necessary and verify keyboard/autofill on devices before acceptance.
- **Cold-start flash:** keep the root bootstrap gate visible until auth resolves.
- **Offline startup:** retain the secure credential and show retry, not guest.
- **Contract drift:** keep mobile DTOs explicit and link the backend HTTP
  contract; do not deep-import backend types.
- **Mock migration blast radius:** provide one temporary account display
  selector, migrate consumers, then delete the mock provider in the same feature.
- **Google UI mismatch:** disable/mark unavailable rather than silently entering
  a fake authenticated state.

## Verification strategy

- TypeScript, ESLint and structure checks for every phase.
- Unit tests for envelope parsing, validation and refresh serialization.
- Provider tests for bootstrap outcomes: no token, valid rotation, rejected token
  and network outage.
- Screen tests for register/verify/login/forgot/reset validation and state.
- Manual run against a configured local API for the complete happy paths.
- Manual cold-start, offline, expired refresh, logout and logout-all checks.
- Confirm public routes and all existing signed-in paths remain unchanged.
