# SkillHub repository guidance

## Workspace and scope

- This is a pnpm/Turborepo monorepo for frontend, backend and shared packages. Git and workspace tooling live at the repository root.
- `apps/*` contains frontend applications; `services/*` contains backend services; `packages/*` contains shared tooling and libraries.
- Work in the workspace relevant to the task. Read its README and any scoped AGENTS.md before making changes.
- Backend-specific architecture, Spec Kit and database guidance live in `services/api`. They apply to backend work, not frontend or unrelated packages.
- Read `docs/` for product requirements. Record unclear business rules instead of inventing them.
- Keep changes focused. When modifying shared packages or root tooling, check the affected consumers and explain the impact.
- Verify implementation in source files; plans and module breakdowns alone do not establish that a feature exists.

## Development and checks

- Install dependencies from the root with `pnpm install`.
- Use `pnpm dev:web` or `pnpm dev:api` to run one workspace; `pnpm dev` runs available development tasks across the monorepo.
- Use `pnpm --filter <package> <script>` for focused checks. Root `pnpm lint`, `pnpm check-types` and `pnpm build` run workspace tasks through Turbo.
- Run checks appropriate to the change. Check affected consumers when shared code or API contracts change.
- Run Next.js type checking and builds sequentially because both generate files under `.next`.
- Keep local configuration and credentials in ignored environment files; use `.env.example` for shared configuration examples.

## Git workflow

- Name branches `<type>/<short-kebab-name>` using lowercase kebab-case and no numeric spec prefix. Choose the type by intent: `feat`, `fix`, `hotfix`, `refactor`, `chore`, `docs`, `style`, `test`, `perf`, `build`, `ci`, `revert`, `experimental`, `release`, or `merge`.
- Examples: `feat/profile-page`, `fix/refresh-token`, `chore/shared-eslint`. Reuse a branch when the change belongs to its scope.
- Use Conventional Commits: `<type>(<scope>): <short description>`, with a lowercase type and concise English description. Commit types: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`, `perf`, `build`, `ci`, and `revert`; hotfix commits use `fix`.
- Scope follows staged paths. One workspace uses its package name without the npm namespace, such as `web`, `api`, or `eslint-config`. Files entirely within one `src/modules/<module>` directory use `package/module`. Root or multiple-workspace changes may omit scope; an explicit scope must identify an existing workspace/module.
- Examples: `feat(web): add profile page`, `fix(api/auth): revoke refresh sessions`, `chore(eslint-config): update lint rules`, and `docs: update contributor setup`.
- Mark incompatible public contract changes with `!` and a `BREAKING CHANGE:` footer.
- Stage only intended changes and review the staged diff. Root hooks run lint-staged and commitlint; they do not replace workspace checks. Do not bypass hooks to hide failures.
- Use `pnpm prepare` to activate hooks if installation skipped lifecycle scripts; use `pnpm test:commitlint` to verify scope validation.
- Branch and commit naming rules do not themselves authorize committing or pushing changes.
