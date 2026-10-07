# SkillHub

Monorepo for SkillHub's frontend, backend and shared packages, managed with pnpm
and Turborepo. The repository root is also the workspace root.

## Repository structure

| Directory                    | Purpose                                    | Workspace                     |
| ---------------------------- | ------------------------------------------ | ----------------------------- |
| `apps/web`                   | Next.js frontend                           | `web`                         |
| `apps/mobile`                | Mobile foundation docs for future Expo app | —                             |
| `services/api`               | NestJS backend                             | `api`                         |
| `packages/eslint-config`     | Shared ESLint configuration                | `@skillhub/eslint-config`     |
| `packages/typescript-config` | Shared TypeScript configuration            | `@skillhub/typescript-config` |
| `docs`                       | Product requirements and data models       | —                             |

Workspace-specific setup and architecture belong in each workspace's documentation.
See the [API README](services/api/README.md) for backend dependencies, migrations
and module design. Mobile guidance starts at [apps/mobile/README.md](apps/mobile/README.md).
Common repository guidance lives in [AGENTS.md](AGENTS.md).

The current business source of truth is
[SRS SkillHub V1.6](docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx).
Older SRS documents remain in `docs/` for historical comparison.

## Getting started

Requires Node.js 22.12+ on the 22.x line (or Node.js 24+) and pnpm 10.24.0.
Run commands below from the repository root:

```powershell
pnpm install
```

Configure any environment variables required by the workspace you are developing.
Use its `.env.example` when available and keep credentials in ignored local files.
The API requires PostgreSQL, MongoDB and Redis; follow its README before starting it.

Run the frontend or backend independently:

```powershell
pnpm dev:web
pnpm dev:api
```

Run `pnpm dev` to start available development tasks across the monorepo once
workspace dependencies and configuration are ready.

| Service       | Default development URL                |
| ------------- | -------------------------------------- |
| Web           | http://localhost:3000                  |
| API health    | http://localhost:3001/api/health       |
| API readiness | http://localhost:3001/api/health/ready |
| API Swagger   | http://localhost:3001/api/docs         |

## Common commands

| Command                | Purpose                         |
| ---------------------- | ------------------------------- |
| `pnpm dev`             | Run development tasks           |
| `pnpm lint`            | Lint workspaces                 |
| `pnpm check-types`     | Type-check workspaces           |
| `pnpm build`           | Build workspaces                |
| `pnpm format`          | Format source and configuration |
| `pnpm format:check`    | Check formatting                |
| `pnpm test:commitlint` | Test commit scope rules         |

Target a single workspace using its package name:

```powershell
pnpm --filter web lint
pnpm --filter web check-types
pnpm --filter api build
```

Run Next.js type checking and builds sequentially because they generate files
under `.next`. Existing `docs/` artifacts are excluded from Prettier formatting.
Run the tests defined by the workspace you changed; shared changes also require
checking affected consumers.

## Branches and commits

Use `<type>/<short-kebab-name>` branches, for example `feat/profile-page`,
`fix/refresh-token` or `chore/shared-eslint`. Names use lowercase kebab-case
without numeric spec prefixes. Reuse a branch for changes within its scope.

Branch types: `feat`, `fix`, `hotfix`, `refactor`, `chore`, `docs`, `style`,
`test`, `perf`, `build`, `ci`, `revert`, `experimental`, `release`, and `merge`.

Use Conventional Commits: `<type>(<scope>): <short description>`. Commit types:
`feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`, `perf`, `build`, `ci`,
and `revert`. Use a concise English description; hotfix commits use `fix`.

| Staged changes                       | Scope                                                   | Example                                   |
| ------------------------------------ | ------------------------------------------------------- | ----------------------------------------- |
| One workspace                        | Package name without npm namespace                      | `feat(web): add profile page`             |
| One `src/modules/<module>` directory | `package/module`                                        | `fix(api/auth): revoke refresh sessions`  |
| Shared package                       | Package name without npm namespace                      | `chore(eslint-config): update lint rules` |
| Root or multiple workspaces          | Optional; if supplied, use an existing workspace/module | `docs: update contributor setup`          |

Mark incompatible public contract changes with `!` and a `BREAKING CHANGE:`
footer. Keep each commit focused and review the staged diff before committing.

Husky hooks run lint-staged (Prettier and configured workspace lint rules) and
commitlint. Use `pnpm prepare` if dependency installation skipped hook setup.
Hooks supplement workspace lint, typecheck, build and tests.
