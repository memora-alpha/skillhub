# Operator Admin account creation from environment

User direction: create a new Admin account using email/password stored in environment
variables. This is an operator CLI, not a public registration/auth endpoint or automatic deploy
seed. Scope: users owner, operator script, configuration example, docs and tests.

## Configuration and command

| Environment variable     | Rule                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| BOOTSTRAP_ADMIN_EMAIL    | Required; normalize trim/lowercase; existing email validation and maximum 254 characters              |
| BOOTSTRAP_ADMIN_PASSWORD | Required; registration password policy, 8–64 chars with uppercase/lowercase/digit/special; never trim |
| BOOTSTRAP_ADMIN_NAME     | Optional; blank/omitted defaults to SkillHub Admin; existing full-name policy                         |
| BOOTSTRAP_ADMIN_REASON   | Optional; blank/omitted uses fixed operator reason; maximum 1000 chars                                |

Configure runtime environment in Coolify, deploy to apply it, then run from the
API container's `/app/services/api`:

```sh
node scripts/create-admin.mjs
```

Local equivalent after API build: `pnpm --filter api identity:create-admin`.
Runtime database and identity configuration must already be valid and migrations
applied. No new schema migration is required. No credential arguments are accepted.
No password is committed, hardcoded, printed or included in audit snapshots.

## Behavior and invariants

1. Validate environment before connecting to the database.
2. Acquire the existing PostgreSQL release advisory lock, shared with release/seed.
3. Run the idempotent identity definition seed to ensure roles and current Admin
   grants (including `skill-level:manage`) exist. This seed has its own transaction.
4. Hash the password with the existing Argon2id policy outside the user transaction.
5. Lock the normalized email with the same transaction advisory lock as OTP account
   creation. Refuse every existing email, including existing Admin/locked/unverified
   accounts. Never reset a password or silently promote an existing account.
6. In one transaction create the User through its owner, activate/attest email,
   assign the single ADMIN role and append `ADMIN_BOOTSTRAP` audit with the operator
   reason and safe created/status/role fields. Any failure rolls back the User and
   hash. Earlier role/permission definition seeding can remain after a failure.
7. Print only `Admin account created: <uuid> (ACTIVE, ADMIN).` and exit successfully.
   Invalid input and existing-email outcomes return exit 1 with static safe messages;
   database/config errors are redacted to a fixed operational message.

This trusted operator provisioning skips OTP for the new Admin only. Public
registration and password recovery retain their current verified-OTP flows. No
HTTP Admin grant is added. Existing UUID-based `identity:bootstrap-admin` is unchanged.
No account is created on ordinary deploy/restart; no `release-seeds.json` request
is added. Rerunning against the same email refuses it. Changing bootstrap password
configuration does not update a previously created account.

Architecture check: PostgreSQL authority and users ownership are preserved;
existing crypto/validation/transaction/audit contracts are reused. No new external
provider, secret in source, frontend modification or constitutional exception.

## Validation

`test/identity/create-admin-account.test.mjs` covers environment normalization,
password preservation, credential-safe CLI errors before DB access, real PostgreSQL
creation and login with Admin permissions, existing-email protection, audit-failure
rollback and same-email concurrency. Fixtures create/drop randomized test schemas;
no application database account is created by validation.

Validation (2026-10-14): API lint, check-types, build, formatting and git diff
whitespace checks passed. The focused seed/Admin plus affected identity/provider/
single-role repository run passed 22 tests, zero failures/skips:

```sh
node --test --test-reporter=spec --test-concurrency=1 test/identity/create-admin-account.test.mjs test/identity/policies.test.mjs test/identity/providers.test.mjs test/identity/sonar-regressions.test.mjs test/runtime-v3-repositories.test.mjs
```

Admin creation/login/permissions, duplicate/existing-account protection, concurrent
same-email creation and audit-failure rollback used real PostgreSQL with a
randomized disposable schema. Provider regressions used controlled local protocol
servers. No account was created in the application database or Coolify, and no
migration, deployment or production provider proof is claimed.
