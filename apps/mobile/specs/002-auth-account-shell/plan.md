# Plan: mobile auth and account shell

## Baseline

- Branch: `feat/mobile-auth-account-shell`.
- Base: `origin/dev` at `da3de45`.
- The original planning baseline used demo auth. Auth/account runtime now uses
  identity v1; learning/calendar/chat content remains local fixtures.
- Backend identity v1 exists in source. Mobile consumes its external contract
  without backend imports; live API/device acceptance is still pending.

## Checkpoint: 2026-10-09

- Ready for development integration. Real mailbox and native acceptance remain pending.
- Implemented: Axios transport, Query/SecureStore account shell, React Hook
  Form/Zod auth/profile forms, singleton toast feedback, keyboard-aware forms,
  read-only verification email and six-cell OTP with 60-second resend cooldown.
- Recovery is email -> server OTP verification -> new password. The published
  `/password/verify-otp` response supplies `resetToken, expiresAt`; final reset
  uses this authorization instead of sending the OTP again.
- Recovery email/proof are memory-only Zustand state, cleared when leaving or
  succeeding. Passwords stay local to the final form. Separate registration
  and recovery cooldown timestamps follow the server's OTP purposes.
- Session-switch retry/expiration and logout-all pending/error findings are
  resolved with regression coverage. All 55 mobile tests and mocked browser
  journeys pass. Provider/storage integration, live email/API acceptance and
  Android/iOS keyboard/SecureStore verification remain pending.

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
  never mirror server account entities or persist recovery OTP/reset authorization.
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
2. Protected calls capture the bound session generation before reading the token.
   They recheck it after async boundaries and reject stale responses.
3. A protected `401` requests one serialized refresh and retries once only while
   the original session remains current; it cannot retry or expire another account.
4. Refresh stores the replacement credential before releasing waiting calls.
5. A second `401` or rejected refresh expires the session. An ambiguous refresh
   outcome retains the in-flight storage marker and requires reauthentication;
   do not replay a possibly consumed refresh credential. Invalid envelopes are
   normalized errors, not an unconditional instruction to clear every session.
6. `204` returns `undefined`; JSON success returns `data`; failures throw the
   normalized `AppError`.
7. Public registration, verification and reset mutations, and the logout-all
   mutation, have no automatic failure retry. Protected calls retain the one
   same-session `401` renewal retry described above.

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
- Preserve neutral send acknowledgments and verify OTP with `/password/verify-otp`.
- Keep email and reset proof memory-only; guard direct entry without valid proof.
  OTP failures stay on code entry. Invalid/expired reset proof restarts from email;
  other failures keep password input and suggest trying the new password at login.
- Submit `email, resetToken, newPassword, confirmNewPassword` to `/password/reset`.
- Do not offer a new-password action to re-enter the consumed OTP.
- Return to login after success without creating a session.

### Published backend recovery contract

Mobile consumes the contract now implemented by the API without backend edits:

- `/password/forgot`: neutral `202`, also used for resend.
- `/password/verify-otp`: `email, otpCode` returns `resetToken, expiresAt` on `200`.
- `/password/reset`: `email, resetToken` plus matching password fields returns `204`.
- Registration verification remains a separate purpose and endpoint. Redis OTP
  attempts are server-enforced; five wrong entries can block OTP for 24 hours.
- OTP/reset proof stay out of URLs and persistent storage. Error feedback remains
  neutral; real delivery, expiry/replay and session-revocation acceptance are pending.

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
  original session generation; regression tests cover late responses and renewal.
- **Reset outcome uncertainty:** preserve input after network/server failure and
  suggest login with the new password; never automatically repeat reset.
- **Native dependencies:** rebuild a development client with keyboard-controller
  when necessary and verify keyboard/autofill on devices before acceptance.
- **Cold-start flash:** keep the root bootstrap gate visible until auth resolves.
- **Offline startup:** retry failures before refresh submission; once rotation may
  have reached the server, retain the pending marker and require reauthentication.
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
