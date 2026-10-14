# API dev deployment

User direction (2026-10-13): all current environments are development. Use the
Memora flow: GitHub checks, then a Coolify webhook to build/deploy branch `dev`.
This replaces the earlier GHCR/self-hosted-runner release plan. Scope is API and
root CI tooling because pnpm, Git and Docker build context belong to the monorepo.
Web/mobile and production deployment are outside scope.

## Flow

1. PRs into `dev` run API lint, typecheck, build, CD/regression tests, real-store
   Connections tests and Docker image validation on GitHub-hosted runners.
2. Relevant pushes to `dev` run the same checks. When they pass, the hosted deploy
   job calls the API application's authenticated Coolify webhook.
3. Coolify checks out `dev` and builds `services/api/Dockerfile` from the repo root.
4. The new dev container obtains a PostgreSQL session advisory lock, applies
   pending PostgreSQL migrations, creates/verifies MongoDB indexes, and runs only
   explicitly requested pending seeds. The dedicated lock session closes afterwards.
5. Only successful bootstrap loads `dist/main.js` in the same Node process.
   `/api/health/ready` verifies PostgreSQL, MongoDB and Redis before the container
   becomes healthy. Bootstrap failure exits before starting the API.

GitHub success means the webhook request was accepted, as in Memora. Check the
Coolify deployment logs and health status for actual deployment success. Coolify
builds its configured `dev` branch; this flow does not pin a previously built
image digest. Workflow concurrency never cancels an active workflow; remote builds
are managed by Coolify. Use one dev API instance and one shared seed-state volume.

## Setup in Coolify

Create a Git-backed application for `memora-alpha/skillhub`:

| Setting | Value |
| --- | --- |
| Branch | `dev` |
| Build pack | Dockerfile |
| Base directory | `/` |
| Dockerfile location | `/services/api/Dockerfile` |
| Exposed port | `3001` |
| Health check | `/api/health/ready` |
| Health startup grace | At least 120 seconds; allow longer for large migrations |
| Persistent storage | Named volume mounted at `/release-state`, writable by UID 1000 (`node`) |

Set runtime values using [`../.env.example`](../.env.example), including the
approved identity policy values and SMTP/storage/scanner configuration. The Docker
image is explicitly `NODE_ENV=development`, running compiled code without watch
mode. Existing production validation remains unchanged. The bootstrap entrypoint
rejects any environment other than `development` before touching the database.

`DATABASE_URL` must allow migrations/seeding in the intended dev database/schema.
`MONGODB_URI` must point to a replica set and allow index creation. Configure Redis
and use addresses reachable from the application container; container-local
`127.0.0.1` is not the database server. Keep actual credentials only in Coolify.
Disable independent Git auto-deploy so GitHub checks precede the webhook. Do not
add migrate/seed to Coolify pre/post-deploy commands; the dev entrypoint owns them.

## Setup in GitHub

Create the **dev** environment and restrict it to branch `dev`. Protect the branch
and require API CI checks. Add only these environment secrets:

| Secret | Value |
| --- | --- |
| `COOLIFY_API_WEBHOOK` | Copy the API application's Deploy Webhook (auth required), using HTTPS and a single resource UUID |
| `COOLIFY_TOKEN` | Team token with `deploy` permission |

There is no self-hosted runner, registry credential, release env file, image UUID
variable, or write/read API token required. The workflow sends a GET with Bearer
authentication; redirect and multi-resource/tag webhooks are rejected. No external
configuration is changed by the repository work.

## Seed only when needed

[`../release-seeds.json`](../release-seeds.json) has an empty `requests` array by
default. An ordinary deploy or container restart runs no seed. Append a reviewed
request in the feature PR when seed data is needed, for example:

```json
{
  "requests": [
    {
      "id": "initial-platform-data",
      "seeds": ["identity", "configuration"],
      "reason": "Initialize a new development database"
    }
  ]
}
```

Use this bootstrap request only when the target database needs its initial
definitions. The example is not an active request in this branch. Later changes
append unique request IDs. Do not edit applied requests. Allowed seed kinds are
`identity` and `configuration`; existing operator values/approved policies remain.

Successful requests are recorded atomically in `/release-state`, scoped by database
host/name/schema. Keep that volume across deploys. A failed request stays pending;
a crash before recording may replay an idempotent seed. The database lock serializes
bootstrap and manual seed commands while its session remains connected. The lock
wait is bounded to 30 seconds. The state volume is operational metadata, not a
business store; back it up alongside the dev database and reconcile it after restores.

For a one-off seed, open the current application's Terminal in Coolify, from
`/app/services/api`, and run the requested selection explicitly:

```sh
RELEASE_OPERATION=seed-only RELEASE_SEED=identity node scripts/release.mjs
RELEASE_OPERATION=seed-only RELEASE_SEED=configuration node scripts/release.mjs
```

Select `both` only when both seeds are needed. Seed-only runs no migration or
automatic requests. Do not persist `RELEASE_SEED` in runtime environment: startup
always forces the manual selection to `none`. Demo data and admin bootstrap remain
separate operator actions. Data backfills/destructive changes require reviewed
migrations rather than generic seeds.

## Create an Admin account from environment variables

Configure these **runtime** values in the API application's Coolify environment
(or an ignored `services/api/.env` for local development):

```dotenv
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=<your-strong-password>
BOOTSTRAP_ADMIN_NAME=SkillHub Admin
BOOTSTRAP_ADMIN_REASON=Initialize development administrator
```

Email and password are required. Name defaults to `SkillHub Admin`; reason defaults
to `Create Admin account from operator environment` when omitted or blank.
Password policy is the registration policy: 8–64 characters with uppercase,
lowercase, digit and special character. Password whitespace is preserved.

After deploying the image that includes this command and applying the runtime
environment, open Terminal for the running **API container** and run:

```sh
cd /app/services/api
node scripts/create-admin.mjs
```

Locally, build once and use `pnpm --filter api identity:create-admin` from the root.
The command accepts no credential arguments and reads only environment values.
It obtains the shared release advisory lock, seeds current roles/permissions,
then creates the account with an Argon2id hash, ACTIVE status, verified email and
the single ADMIN role. This trusted operator action attests the email; ordinary
public registration still requires OTP. User creation, activation, role and
`ADMIN_BOOTSTRAP` audit commit together or roll back together. The printed result
contains only the new UUID and status/role, never a password or password hash.

Success: `Admin account created: <uuid> (ACTIVE, ADMIN).` The account can log in
with the configured email/password. Existing normalized emails are refused;
rerunning does not reset a password, replace roles, activate or unlock an account.
Use the separate UUID-based bootstrap if an existing verified ACTIVE account
should be promoted. The create command does not run migrations, does not create
accounts on container restart, and is not included in `release-seeds.json`.
Credentials belong in runtime secrets, not Git/build arguments. The bootstrap
password variable can be removed after successful creation; changing it later
does not rotate the account's password.

See [Admin account seed contract and validation](../specs/002-user-identity/admin-account-seed.md).

## Validation and recovery

API bootstrap, seed ordering, retry/state recording and PostgreSQL lock boundaries
are tested with temporary files and simulated dependencies. Webhook tests verify
authentication, failure handling and validation before transmission. API/CD lint,
formatting, workflow actionlint and the local SonarJS complexity/rule subset pass.
These checks do not establish a published Sonar gate or a live deployment.

16 CD tests pass. A separate localhost PostgreSQL proof verified that the second
bootstrap waits until the first lock session closes, using a unique advisory-lock
key and reading `pg_locks`. No schema/table, migration, seed or application data
was changed by that proof.

Docker engine is unavailable locally: image smoke checks, real database bootstrap,
Coolify rollout and server/volume setup are pending. GitHub/Coolify configuration
and live migrations/seeds were not performed for this simplification.

Inspect Coolify startup/deployment logs after failure. Fix failed migrations or seed
state before redeploying; restarting cannot repair invalid schema/data. Keep schema
changes compatible with the old API during replacement. Image rollback does not
undo migrations or seeds; PostgreSQL/MongoDB/seed changes are separate operations.

Constitution check: principles 1/2/3/7 unchanged (module ownership, stores and
transactions); 4/5 retain secrets/config validation and contracts; 8 uses serialized
idempotent seed requests and completion markers; 6 passes local verification with
the runtime gates above pending. Dev bootstrap is an explicit deployment choice,
not a change to business rules. No constitutional exception is introduced.

References: [Memora workflow](https://github.com/memora-alpha/memora/blob/dev/.github/workflows/deploy-dev.yml)
is the reference; [Coolify deploy webhooks](https://coolify.io/docs/core/automation/deploy-webhooks)
describe the request/acceptance behavior. [PR #21 remediation](sonar-pr21.md)
records the earlier published Sonar snapshot; require a new analysis for this version.
