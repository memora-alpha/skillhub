# API continuous delivery

Branch: `ci/api-cd`. Scope: API container/release commands and repository workflows.
Root workflow tooling is necessary because Git, pnpm, shared packages and the Docker
build context belong to the monorepo. Web/mobile code and deployment are outside scope.
This is deployment configuration; it does not change business policies or API contracts.

## Release sequence

1. PRs targeting `dev` run API lint, typecheck, build, regression/CD tests, real
   PostgreSQL/MongoDB Connections tests and a Docker image build on hosted runners.
2. Relevant pushes to `dev` rerun the checks and build/publish
   `ghcr.io/<owner>/<repository>-api:sha-<commit>-<run>-<attempt>`.
3. A dedicated self-hosted Linux x64 runner pulls the resulting **digest**, checks
   its commit label, verifies the configured Coolify application, and acquires a
   server-side release lock. The release container uses that same digest.
4. Apply PostgreSQL migrations, then MongoDB indexes, then explicitly requested
   pending seeds. Stop on any failure before requesting API deployment.
5. Update the Docker Image application's tag/hash to `sha256-<digest>`, trigger
   deployment, wait for the specific deployment UUID to finish with that digest,
   and verify `/api/health/ready` before unlocking and reporting success.

Workflow concurrency includes the whole release and never cancels an active run.
GitHub may replace an older pending run with a newer one; seed requests remain in
the append-only plan so they are not lost with a skipped commit. Retry an explicitly
requested manual operation if its pending workflow is replaced. The Docker lock
also prevents overlapping releases after a workflow cancellation or timeout.

## Seed only when needed

[`../release-seeds.json`](../release-seeds.json) starts with an empty `requests`
array. Ordinary deploys run no seed. When a feature requires seed data, append a
reviewed request in the same PR, for example:

```json
{
  "requests": [
    {
      "id": "catalog-restore-permissions",
      "seeds": ["identity"],
      "reason": "Add the catalog and sharing-skill restore grants"
    }
  ]
}
```

Allowed seed kinds are `identity` and `configuration`. A request can select both.
Keep IDs unique; do not edit or remove applied requests. Append a new ID when data
needs another update. The example above is documentation, not an active seed request.

The release runner records successful requests in a persistent Docker volume,
scoped by PostgreSQL host/database/schema. Subsequent deploys skip them. A changed
applied request fails before migration. Failed requests remain pending; a crash
between seed completion and recording can replay a seed, so seed implementations
must remain idempotent. This ledger is operational metadata, not a business store.
Back it up alongside the database and retain it across runner/image replacement.
Do not delete/reuse its volume when changing environments. For a database restored
to an earlier point, reconcile seed state with that restore before the next release.

For an operator-requested seed, dispatch **Deploy API Dev**, choose branch `dev`,
`operation=seed-only`, and `seed=identity`, `configuration`, or `both`.
This runs only that selection, without migrations, automatic requests or deployment.
`operation=deploy` plus an explicit seed runs it before deploying. Both selections
default to `deploy`/`none`. Demo data and admin bootstrap are never included.

For the first deployment to an empty database, explicitly dispatch `deploy` with
`seed=both`, or add a reviewed bootstrap request. Do not assume migrations seed roles
or configuration. Existing operator configuration/approved fee policies are kept;
the seeds add missing definitions. Backfills and destructive policy changes require
a separate reviewed migration, not a generic seed.

## Server and GitHub setup

Create the GitHub **dev** environment with deployment restricted to branch `dev`.
Protect that branch and require `API CI` checks before merging. Register a dedicated
self-hosted runner with labels `self-hosted`, `linux`, `x64`, `skillhub-dev-release`.
Only the trusted `dev` deploy workflow uses it; PR checks stay on hosted runners.
The runner needs Node 22.12+, a root-owned Docker CLI at `/usr/bin/docker`,
outbound HTTPS access and network access to
the target stores. Its Docker daemon must stay on the same server so the release
lock and seed-state volume survive runner replacement. Keep manual operations in
this workflow rather than starting concurrent release commands elsewhere.

Set these **dev environment variables**:

| Variable | Value/purpose |
| --- | --- |
| `COOLIFY_API_URL` | Trusted HTTPS base URL ending in `/api/v1`, without trailing slash |
| `COOLIFY_API_UUID` | Dedicated SkillHub API Docker Image application UUID |
| `API_READINESS_URL` | Public HTTPS URL ending in `/api/health/ready` |
| `RELEASE_ENV_FILE` | Absolute path to a server-owned Docker env file for the release container |
| `RELEASE_DOCKER_NETWORK` | Docker network that reaches the deployment PostgreSQL/MongoDB |
| `RELEASE_STATE_VOLUME` | Persistent volume unique to this application/environment |

Set `COOLIFY_TOKEN` as a **dev environment secret**. It needs read access to verify
and poll deployments, write access to update the image digest, and deploy permission.
A deploy-only webhook token is insufficient for this flow. The GitHub token grants
publish/read access to the workflow's GHCR package. Configure separate persistent
read-only GHCR credentials on every Coolify deployment server for private images;
the runner's temporary login does not authenticate Coolify's pulls.

Create a Coolify **Docker Image** application with image name exactly
`ghcr.io/<owner>/<repository>-api` (lowercase), port `3001`, and liveness health check
`/api/health`. Configure domain, runtime environment and resource limits there.
The deployment workflow supplies the image digest. Do not enable independent Git
auto-deploy or migrate/seed in pre/post-deploy hooks or API startup.

The release env file contains the target `DATABASE_URL` (migration privileges) and
`MONGODB_URI` (replica set and index privileges), plus any required CA settings.
They must target the same database/schema as the API runtime. Keep this file outside
Git/runner checkout and restrict server file permissions. API runtime credentials
can use lower privileges. Runtime variables follow [`../.env.example`](../.env.example).
The image defaults to `NODE_ENV=production`; the existing API then requires verified
TLS for PostgreSQL/MongoDB/Redis, HTTPS CORS and the production identity settings.
No live credentials are embedded in the image/workflow. Prisma generation uses a
build-only dummy URL and never applies migrations during image build.

## Failure and recovery

Migration/index/seed failures stop before the Coolify image update. A failed seed
does not acquire a completion marker. Failures, timeouts or cancellation after
acquiring the release lock leave the stopped container
`skillhub-release-lock-<application-uuid>` for inspection. The next release fails
closed until an operator checks for an active release container/Coolify deployment,
investigates the database state, and removes only that lock container.

Use Docker/container metadata and the specific Coolify deployment logs for diagnosis;
provider exception output is not relayed into public Actions logs. Do not blindly
retry a release with a running remote deployment. Image rollback does not reverse
migrations/seeds. Use backward-compatible schema expansion, backfill, then a later
contract migration for changes that affect the currently running API. PostgreSQL,
MongoDB and seed steps are separate commits, not one cross-store transaction.

## Constitution check and validation

Principles 1/2/3/7: Pass for design; module owners, authoritative stores and financial
transactions are unchanged. Principle 4: token/env separation, non-root container,
trusted runner and redacted errors implemented. Principle 5: runtime environment
validation and HTTP contracts unchanged. Principle 8: explicit seed requests,
atomic completion markers and serialized releases support safe retries; applied
schema/data changes require the recovery procedure above. No architectural exception.

Principle 6 evidence on 2026-10-13:

- 11 CD control tests passed, using temporary seed ledgers and simulated Docker/API
  responses: empty plan, replay, per-database state, failed seed retry, immutable
  request IDs, explicit seed-only, migration failure, deployment failure/timeout,
  digest validation, credential handling and retained release locks.
- API and CD JavaScript lint, Prettier and workflow actionlint checks passed.
- The restricted Windows sandbox blocked atomic file rename in two fixture tests;
  the identical suite passed outside that sandbox. Tests did not touch real databases.
- Docker engine is unavailable locally. Container build, Linux image smoke checks,
  hosted GitHub checks, real release migrate/seed and Coolify rollout are **Pending**.
  The server runner/application/env/registry setup above is also **Pending**.
- No external configuration, deployment or live migration/seed occurred. The user
  authorized a local CD commit; no push was requested.

References: [Coolify Docker Image](https://coolify.io/docs/applications/deployments/docker-image),
[application update API](https://coolify.io/docs/api/endpoints/applications/update-application-by-uuid),
[deployment status API](https://coolify.io/docs/api/endpoints/deployments/get-deployment-by-uuid).

Sonar remediation for PR #21 is tracked in [sonar-pr21.md](sonar-pr21.md).
