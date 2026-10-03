# Identity implementation and verification guide

Future guide: identity routes/config/tests are not implemented by planning. Foundation tests are not identity evidence.

## Setup

From root `pnpm install`. From `services/api`, use ignored `.env` based on `.env.example`; `pnpm infra:up` or team services for PostgreSQL/MongoDB/Redis. Use isolated data and controlled mailbox/S3/scanner test providers; production must not expose a test mailbox or print codes.

Obtain terms version/default timezone/approved initial reputation; keep Staff administrative grants empty until approved. Configure lifetimes/reauth/throttle/retention explicitly; test fixture values are not production defaults. Registration OTP defaults are defined by SRS. Production requires actual email/storage/scanner adapters.

Existing commands (from API):

```powershell
pnpm db:validate
pnpm db:deploy
pnpm lint
pnpm check-types
pnpm build
pnpm test:foundation
```

Implementation adds migrations with existing `pnpm db:migrate` in disposable development storage, plus identity test scripts (none exist today). Do not run deployment/bootstrap/migrations/email sends for this documentation-only plan. Swagger at `/api/docs` in development/test must match [contract](contracts/http.md).

## Acceptance walkthrough after implementation

Call identity endpoints under `/api/v1/...`, for example `POST /api/v1/auth/register`, `POST /api/v1/auth/login` and `GET /api/v1/me`. Swagger at `/api/docs` must list all 21 versioned method/path pairs. Verify missing/unsupported identity versions return404 and existing `/api/health` and `/api/health/ready` remain available as version-neutral operational endpoints.

1. Register mixed-case email; neutral202/no tokens; controlled mailbox and DB show one pending User/profile/USER grant/challenge/outbox. Duplicate cannot alter credentials.
2. Pending login issues no token; wrong/expired proof rejected; valid REGISTER proof activates once. Login then own/other-user profile projections preserve privacy.
3. Refresh rotates; old-token replay commits family revoke. Fresh two-device fixtures prove current logout preserves other device, logout-all revokes both.
4. Existing/unknown forgot email share safe response. Reset consumes once, revokes old access/refresh and sends change email; new password works and status never unlocks.
5. Profile unknown/role/status/metric injection rejected. Valid scanned avatar selected; malformed/spoofed/oversized/foreign/quarantined upload never replaces avatar.
6. Audited isolated Admin fixture versus USER/ungranted/delegated STAFF verifies exact matrix; lock rejects subsequent tokens, unlock restores no sessions; STAFF grants need one-use recent Admin proof.

## Required real-storage/e2e matrix

| Area                 | Required evidence                                                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signup               | 20 normalized-email racers create one aggregate; transaction failure leaves no partial challenge/outbox                                                                     |
| OTP                  | 20 consumes maxone transition; failed counters commit; expiry/leading zeros/purpose; five-attempt and 60sec/five-hour resend boundaries under concurrency                   |
| Refresh              | Concurrent token cannot create surviving chains; replay revoke survives error; expiry/version; lost response strict replay documented                                       |
| Revoke races         | Reset/lock vs login/refresh under real row locks; no stale post-revoke usable credential; repeat logout harmless                                                            |
| Permission/audit     | Owner/nonowner/role/grant matrix, actor grant race, reauth replay/wrong purpose/session; audit failure rolls back mutation                                                  |
| Email/outbox         | Crash before/after enqueue/provider acceptance; expired leases; Redis outage; retry exhaustion; stale generation rejection; encrypted payload/key rotation/terminal erasure |
| Avatar               | MIME/content/5MB boundary, scanner outage/malware rejection, quarantine inaccessible, atomic select, duplicate orphan/old cleanup                                           |
| Privacy              | Captured request/response/job/audit logs and allowlisted public view leak zero secrets; generic email/timing behavior                                                       |
| Config/contracts     | Missing production config fails startup; unknown fields400; JWT wrong type/algorithm/issuer/audience; UTC/cursor validation; generated Swagger matches                      |
| Distributed throttle | Two API replicas share email/IP/purpose limits; Redis failure denies required auth operations safely                                                                        |

Use real PostgreSQL/Redis for uniqueness/locks/counters, injectable clock/provider failures and isolated secrets. Mocks alone do not establish concurrency behavior. Retain health/readiness regression checks; record static/runtime evidence in [validation.md](validation.md).
