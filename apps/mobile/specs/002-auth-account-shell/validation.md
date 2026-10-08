# Validation: mobile auth and account shell

## Planning baseline

- Branch created from `origin/dev` at `da3de45`.
- Current auth UI uses local `MockSessionProvider` state.
- Mobile has no HTTP client, secure credential store or TanStack Query provider.
- Backend identity v1 exposes the required register, verify, login, refresh,
  logout, logout-all, forgot/reset and own-account endpoints.
- Google OAuth, email change and session-management endpoints are not in the
  approved v1 contract.

## Required automated checks

```powershell
pnpm --filter mobile check-types
pnpm --filter mobile lint
pnpm --filter mobile check-structure
pnpm --filter mobile test
```

The test command does not exist at planning time. Add it only when the first
auth infrastructure tests are introduced.

## Required integration evidence

- Registration returns neutral `202`, then valid OTP verifies with `204`.
- Login returns tokens and `GET /me` populates the signed-in shell.
- Cold start rotates one stored refresh token and replaces it securely.
- Concurrent protected requests issue only one refresh request.
- Invalid refresh resolves to guest and removes local credentials.
- Offline bootstrap preserves the stored token and offers retry.
- Current logout and logout-all both clear local state.
- Forgot/reset preserves neutral responses and does not auto-login.
- No password, OTP, refresh token or Authorization value appears in logs.

## Current status

Planning complete. No auth runtime code, dependencies, API calls or backend files
have been changed in this planning increment.
