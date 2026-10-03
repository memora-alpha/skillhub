# Proposed identity HTTP contract

Implemented identity HTTP contract, published by development/test Swagger. Identity API URI prefix `/api/v1`, UUID identifiers, UTC ISO timestamps, JSON unless multipart; reject unknown fields. No BIGINT output. Preserve existing error `{error:{statusCode,message}}` without a breaking envelope change. See [validation](../validation.md) for verified behavior and release configuration.

Identity routes explicitly use version `1` with NestJS URI versioning, after global prefix `api`. No unversioned identity alias is provided; missing/unsupported versions return404. Existing health/readiness are version-neutral at `/api/health` and `/api/health/ready`; Swagger remains `/api/docs` and describes the versioned identity paths. Incompatible public-contract changes require a new URI version with a documented support/deprecation policy.

Protected routes use Bearer access JWT plus live session/User/status/securityVersion and current permissions. Missing identity=401, denied permission=403. Owner derives from principal. Public profile is an authenticated public projection in this scope. Refresh credentials use JSON, never URLs; browser cookie/BFF/CSRF integration deferred. Token responses `Cache-Control:no-store`; never log credential bodies/responses.

## Routes

| Method/path                                     | Access                     | Request                                                               | Response/behavior                                                                                                         |
| ----------------------------------------------- | -------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| POST /api/v1/auth/register                      | Guest                      | fullName,email,password,confirmPassword,agreeTerms; timezone?,locale? | 202 neutral acknowledgment for valid existing/new email; no tokens; validation400/throttle429                             |
| POST /api/v1/auth/verification/resend           | Guest                      | email                                                                 | 202 same acknowledgment; server REGISTER purpose; SRS limits                                                              |
| POST /api/v1/auth/verification/verify           | Guest                      | email,otpCode six digits                                              | 204; all wrong/expired/nonexistent/superseded/exhausted proof400 OTP_INVALID_OR_EXPIRED                                   |
| POST /api/v1/auth/login                         | Guest                      | email,password,rememberMe?=false                                      | 200 TokenPair; wrong credentials401 INVALID_CREDENTIALS; correct credentials/nonactive403 ACCOUNT_NOT_ACTIVE; throttle429 |
| POST /api/v1/auth/refresh                       | Renewal credential         | refreshToken                                                          | 200 new TokenPair; consume old; invalid/expired/replayed401; replay commits family revoke                                 |
| POST /api/v1/auth/logout                        | Renewal credential         | refreshToken                                                          | 204 neutral/idempotent; revoke supplied family even if access expired; invalid token also204                              |
| POST /api/v1/auth/logout-all                    | Authenticated              | empty object                                                          | 204 revoke every User family                                                                                              |
| POST /api/v1/auth/password/forgot               | Guest                      | email                                                                 | 202 neutral acknowledgment including unknown/ineligible                                                                   |
| POST /api/v1/auth/password/reset                | Guest                      | email,otpCode,newPassword,confirmNewPassword                          | 204 consume RESET_PASSWORD/revoke all; invalid proof400 neutral; no auto-login                                            |
| POST /api/v1/auth/reauthenticate                | Authenticated ADMIN        | password,purpose=STAFF_ROLE_CHANGE                                    | 200 reauthToken/expiresAt; one-use/session/action-bound; wrong password401                                                |
| GET /api/v1/me                                  | Authenticated              | none                                                                  | 200 OwnIdentity                                                                                                           |
| PATCH /api/v1/me/profile                        | Owner                      | subset fullName,headline,bio,timezone,locale; nonempty                | 200 OwnProfile; reject roles/status/email/metrics/storage keys                                                            |
| POST /api/v1/me/avatar                          | Owner                      | multipart image<=5 MB                                                 | 202 assetId/status QUARANTINED; 413 oversize,415 invalid type; scan then atomic select                                    |
| GET /api/v1/me/avatar/uploads/{assetId}         | Owner                      | UUID                                                                  | 200 assetId/status; foreign/missing404; CLEAN means profile selected                                                      |
| DELETE /api/v1/me/avatar                        | Owner                      | none                                                                  | 204 clear selection and schedule idempotent cleanup                                                                       |
| GET /api/v1/profiles/{userId}                   | Authenticated              | UUID                                                                  | 200 PublicProfile for ACTIVE; missing/nonpublic404                                                                        |
| GET /api/v1/admin/users                         | users.read                 | cursor?,limit?,status?,role?                                          | 200 items/nextCursor; default20,max100,createdAt/id descending; bad cursor400                                             |
| POST /api/v1/admin/users/{userId}/lock          | users.lock                 | reason nonblank1–1000                                                 | 204 ACTIVE→LOCKED/revoke/audit; wrong state409                                                                            |
| POST /api/v1/admin/users/{userId}/unlock        | users.unlock               | reason nonblank1–1000                                                 | 204 verified LOCKED→ACTIVE/audit; sessions stay revoked; wrong state409                                                   |
| PUT /api/v1/admin/users/{userId}/roles/staff    | ADMIN + roles.staff.assign | reauthToken,reason nonblank1–1000                                     | 204 idempotent STAFF add + consume reauth/audit; preserve USER/ADMIN                                                      |
| DELETE /api/v1/admin/users/{userId}/roles/staff | ADMIN + roles.staff.assign | reauthToken,reason nonblank1–1000                                     | 204 idempotent STAFF removal + consume reauth/audit; preserve USER/ADMIN                                                  |

Neutral acknowledgment: `{message:"If eligible, instructions will be sent"}`. Rate limits consistent for unknown emails; throttle storage outage safe503. Use trusted proxy IP policy, not arbitrary forwarded headers. Cursor validates sort/filter context. Role/audit no-op results explicit; no grant/no-op bypass of fresh proof or authorization.

## Shapes

- TokenPair: `{accessToken,refreshToken,tokenType:"Bearer",expiresIn:number,refreshExpiresAt:string}`; expiry seconds/UTC, no family extension beyond configured absolute lifetime.
- OwnIdentity: `{userId,email,emailVerified,accountStatus,roles:string[],profile:OwnProfile}`; never verifier/session internals/failed count.
- OwnProfile: `{userId,fullName,headline,bio,timezone:string|null,locale,avatarUrl:string|null,reputationScore:number|null,verifiedSkillCount:number,completedSessionCount:number}`.
- PublicProfile: `{userId,fullName,headline,bio,avatarUrl,reputationScore,verifiedSkillCount,completedSessionCount}` only; no email/role/status/session/terms/payment fields.
- AdminUserSummary: `{userId,fullName,maskedEmail,accountStatus,roles,createdAt}`; credentials never available to Admin.

Full field validation follows spec FR-001/008/009. Bio plain text; API clients must render as text. Metrics read-only, reputation null until initialization configured; skills/history omitted until later contracts. JWT explicitly access type, trusted algorithm/keys, iss/aud/exp/sub/sid validation. Stable safe messages for invalid proof/credentials/state use current envelope; no provider/DB details. Swagger generated in implementation documents schemas/statuses per route.

## Permission matrix and bootstrap

| Action                 | USER          | STAFF                                          | ADMIN                                     |
| ---------------------- | ------------- | ---------------------------------------------- | ----------------------------------------- |
| Own profile/session    | Ownership     | Ownership                                      | Ownership                                 |
| Public profile         | Authenticated | Authenticated                                  | Authenticated                             |
| users.read/lock/unlock | Deny          | Deny initially; only approved delegated subset | Explicit identity grants                  |
| roles.staff.assign     | Deny          | Deny even with stray grant                     | Role AND permission AND fresh bound proof |
| ADMIN grant            | No HTTP route | No HTTP route                                  | Operator bootstrap only                   |

Seed role/permission definitions idempotently; never hardcode production Admin credentials. Audited operator bootstrap assigns ADMIN to an existing verified ACTIVE account. No public permission editing until approved Staff mapping; no Google/email-change/suspend/deactivate/moderation/anonymous profile routes here.
