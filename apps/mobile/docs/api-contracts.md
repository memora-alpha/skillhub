# Mobile API contracts

## Current contract status

The mobile UI is scaffolded but still uses local demo session state. Backend
identity v1 is implemented and documented in
`services/api/specs/002-user-identity/contracts/http.md`. Mobile consumes it as
an external contract and must not import backend source or modify backend code
unless the user explicitly requests backend work.

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

## Remaining contract gaps

- Google OAuth, email change and device/session management are not exposed in v1.
- Exact Learning Path, LearningPlan and Schedule DTOs for SRS 1.6.
- Exact enum values for exchange type, plan status, schedule status and report reason codes.
- Exact payment status polling contract after redirect.
- Exact upload limits and MIME policy for evidence, chat attachments and materials.
- Exact LiveKit token endpoint and join-window behavior.
- Exact material purchase and entitlement endpoints.
