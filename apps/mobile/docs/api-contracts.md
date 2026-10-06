# Mobile API contracts

## Current contract status

Mobile code has not been scaffolded yet. Treat backend APIs as external contracts owned by `services/api` and documented by backend specs. Do not modify backend code from a mobile task unless the user explicitly asks for it.

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
  fieldErrors?: Record<string, string[]>;
  code?: string;
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

## Suggested app error codes

Use backend codes when available. These names are placeholders until the API contract is finalized:

- `VALIDATION_ERROR`
- `EMAIL_ALREADY_EXISTS`
- `OTP_INVALID_OR_EXPIRED`
- `AUTH_INVALID_CREDENTIALS`
- `ACCOUNT_NOT_ACTIVE`
- `FORBIDDEN`
- `RESOURCE_NOT_FOUND`
- `CONFLICT`
- `VERSION_MISMATCH`
- `INSUFFICIENT_CREDIT`
- `CONTENT_REJECTED`
- `RATE_LIMITED`
- `NETWORK_ERROR`
- `UNKNOWN`

## Contract gaps to confirm before coding features

- Exact auth endpoints, refresh behavior and logout/revoke semantics.
- Exact Learning Path, LearningPlan and Schedule DTOs for SRS 1.6.
- Exact enum values for exchange type, plan status, schedule status and report reason codes.
- Exact payment status polling contract after redirect.
- Exact upload limits and MIME policy for evidence, chat attachments and materials.
- Exact LiveKit token endpoint and join-window behavior.
- Exact material purchase and entitlement endpoints.
