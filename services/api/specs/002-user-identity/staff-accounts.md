# Direct STAFF account creation and duplicate registration — 2026-11-06

User correction: create STAFF accounts directly. There is no invitation, email
activation, invitation storage/migration, delivery worker or new environment setting.

## API

`POST /api/v1/admin/users/staff` requires Bearer authentication, current ADMIN,
`roles.staff.assign` and the existing session-bound one-use `reauthToken` obtained
from `/auth/reauthenticate` with `purpose: STAFF_ROLE_CHANGE`.

```json
{
  "email": "staff@example.com",
  "fullName": "Nguyễn Hà",
  "password": "StrongPassword123!",
  "confirmPassword": "StrongPassword123!",
  "reauthToken": "one-use-admin-proof"
}
```

No input `reason`. Role/status/verification flags and extra fields are rejected.
Email/name normalization and password/confirmation validation match registration.
The password is hashed with Argon2id and never returned or written to audit.

Success is HTTP 201:

```json
{
  "success": true,
  "message": "Staff account created.",
  "data": { "userId": "UUID" }
}
```

The account is immediately ACTIVE with role STAFF and can log in using the supplied
password. Trusted Admin provisioning attests the email (`emailVerified:true`),
consistent with the existing operator-created Admin flow; it does not send OTP or
email. Identity terms/default profile metadata follows the existing provisioned
account creation contract. There is no recipient consent/activation flow.

- 400: invalid input, password mismatch/weak password, unsupported fields.
- 401: invalid session or invalid/expired/consumed/wrong-session reauth proof.
- 403: current ADMIN role/permission denied, including stale privileged claims.
- 409 `EMAIL_ALREADY_EXISTS`: normalized email already exists in any account
  status. Existing password/profile/role is preserved. To promote an existing USER,
  use the separate assign STAFF endpoint, whose existing contract is unchanged.

`POST /auth/register` now returns the standard 409 envelope with message
`EMAIL_ALREADY_EXISTS` for an existing email, without creating a draft or OTP.
This user-approved change intentionally exposes account existence in the current
v1 API. New email retains the existing Redis/OTP 202 flow. Pending draft repeats
preserve the original draft; recovery/resend remain neutral. Clients map the code
to “Email này đã được đăng ký. Vui lòng đăng nhập hoặc khôi phục mật khẩu.”

## Design / Constitution Check

Scope remains API-only. `users` owns account/role changes through UsersService and
CreateStaffUseCase; existing auth services own live sessions and proof consumption.
Password hashing occurs before the transaction. Creation takes the normalized
email advisory lock used by registration verification, then locks Admin, rechecks
live role/permissions, checks uniqueness, consumes proof, creates User, assigns
STAFF, activates, and appends `STAFF_CREATED` audit in one PostgreSQL transaction.
The audit records actor, target, timestamp and resulting role/status without a reason
or credentials. Failure rolls back account/grants/audit/proof. Unique database email
remains the final invariant. No external I/O or cross-store delivery is introduced.

Constitution principles 1–5 and 7: Pass for source/design and focused local checks.
Principle 6: local validation recorded below; real PostgreSQL remains Pending.
Principle 8: Not applicable to this synchronous database operation. No exception,
new migration, seed, environment variable or frontend activation page is needed.
Existing ADMIN grants and identity configuration must already be deployed.

## Verification

Unit/HTTP tests cover immediate active STAFF creation, password hashing, permissions,
fresh role/session checks, one-use proof, duplicate safety, audit rollback, strict DTOs,
201/error envelopes and absence of an activation endpoint. Existing title and
pagination regressions remain part of the combined check run.

`pnpm --filter api test:identity:staff:integration` requires an explicitly isolated
TEST_DATABASE_URL plus standard identity test configuration. It tests actual login,
concurrent duplicate creation, one-proof parallel creation, stale-role denial and
transaction rollback in a generated disposable schema. It never falls back to the
application database. Local execution is unavailable without that test URL.

Local results for the corrected revision: lint, TypeScript checking, Nest build,
Prisma validation and diff checks pass. Combined regressions pass 86/86: identity
21, Learning Path read/HTTP 7, learning-platform phases 52, outbox 3 and runtime
identity repositories 3. Provider checks use controlled local servers. PostgreSQL
integration stops at preflight because TEST_DATABASE_URL is absent; no application
database, migration or deployment was changed.
