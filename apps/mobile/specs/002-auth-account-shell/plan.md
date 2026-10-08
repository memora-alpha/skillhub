# Plan: mobile auth and account shell

## Baseline

- Branch: `feat/mobile-auth-account-shell`.
- Base: `origin/dev` at `da3de45`.
- Existing UI is complete enough to preserve; current auth/session behavior is
  local demo state and must be migrated incrementally.
- Backend identity v1 is implemented and verified. Mobile consumes it as an
  external contract and does not import backend source.

## Decisions

- Use the platform `fetch` API behind one client in `src/lib/http`.
- Add TanStack Query for own-account server state and mutation invalidation.
- Add Expo SecureStore for refresh-token persistence.
- Keep access tokens in memory and reconstruct sessions through refresh on app
  startup.
- Implement a single-flight refresh coordinator shared by bootstrap and HTTP
  retry. Never send the same refresh token concurrently.
- Keep form state local to each auth screen. Do not add Zustand for this scope.
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
  features/auth/
    api/
      auth-api.ts
      auth-contracts.ts
    components/
      OtpInput.tsx
      SessionGate.tsx
    context/
      AuthSession.tsx
    hooks/
      use-auth-actions.ts
    screens/
      LoginScreen.tsx
      RegisterScreen.tsx
      VerifyEmailScreen.tsx
      ForgotPasswordScreen.tsx
      ResetPasswordScreen.tsx
    utils/
      validateRegistration.ts
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
`index.ts`; routes remain thin.

## Session model

```ts
type AuthState =
  | { status: "bootstrapping" }
  | { status: "guest" }
  | { status: "offline"; retry: () => void }
  | { status: "authenticated"; accessToken: string };
```

The context exposes state plus login, logout, logout-all and retry-bootstrap.
TanStack Query owns `OwnIdentity`. A small compatibility selector maps
`OwnIdentity` to the display fields currently consumed by header/profile code
during migration.

## HTTP and renewal flow

1. `request()` resolves the configured API base URL and sends JSON unless the
   request is multipart or bodyless.
2. Protected calls read the current access token through an injected getter.
3. A protected `401` requests one serialized refresh and retries once.
4. Refresh stores the replacement credential before releasing waiting calls.
5. A second `401`, invalid envelope or rejected refresh clears auth state.
6. `204` returns `undefined`; JSON success returns `data`; failures throw the
   normalized `AppError`.
7. The client never retries registration, verification, reset or other mutation
   failures automatically.

## Implementation phases

### Phase 1: infrastructure and bootstrap

- Add and configure TanStack Query and Expo SecureStore.
- Validate `EXPO_PUBLIC_API_URL` in `src/config/env.ts`.
- Implement response parsing, normalized errors and the fetch client.
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
- Add reset-password form and OTP handling.
- Return to login after success without creating a session.

### Phase 5: profile migration and hardening

- Wire own-profile edits to `PATCH /api/v1/me/profile`.
- Remove remaining demo-session dependencies from authenticated shell code.
- Add focused integration tests for bootstrap, renewal, logout and route gates.
- Verify no credential data appears in logs, errors or persisted non-secure
  storage.

## Dependency changes

- Add `expo-secure-store` through `npx expo install expo-secure-store --npm`.
- Add `@tanstack/react-query` to the mobile package.
- Add a focused Expo-compatible test stack only with the first executable tests;
  do not add a framework without tests that use it.

Lockfile updates must include both `apps/mobile/package-lock.json` and the root
`pnpm-lock.yaml`, then be verified from the root workspace.

## Risks and mitigations

- **Refresh replay:** serialize rotation and retry once; clear on ambiguity.
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
