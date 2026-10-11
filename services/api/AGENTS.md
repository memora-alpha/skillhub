# SkillHub API

## Scope and working directory

- This directory is the Spec Kit project root. The Git and pnpm workspace root remains `../..`.
- Run Spec Kit commands from `services/api`; keep specifications in `services/api/specs` and shared process files in `services/api/.specify`.
- Development scope defaults to the backend here unless the task explicitly changes scope. Do not modify `apps/web` without an explicit request. If backend work requires a shared package or root tooling change, record the reason in the feature plan.
- Do not initialize a nested Git repository.

## Project context

- Backend: NestJS 11, TypeScript 6, pnpm workspace package `api`.
- Source: `src/`. Build output: `dist/`. Default port: 3001. Health endpoint: `/api/health`.
- Product requirements and data models are in `../../docs/`. Treat unspecified business rules as open questions rather than inventing values.
- Read `README.md` for module responsibilities, ownership boundaries, and implementation order. This is a design breakdown; verify source files before treating a module as implemented.
- Follow `.specify/memory/constitution.md` and `specs/001-backend-foundation/plan.md` for accepted architecture and storage decisions. PostgreSQL/Prisma owns relational and financial state; MongoDB/Mongoose owns chat messages. Verify implementation status independently of technology decisions.

## Commands from this directory

```powershell
pnpm dev
pnpm lint
pnpm check-types
pnpm build
```

Use the workspace commands from `../..` when a change affects shared packages. Run Next.js type checking and builds sequentially if web checks are needed.

## Agent integrations

Follow the constitution's Git workflow: branches use `<type>/<short-kebab-name>`
without spec numbers; commit scopes follow staged workspace/module paths. Keep
spec directory numbering independent of branch names. Git hooks live at the repo
root and apply to both Codex and Claude.

- Codex skills: `.agents/skills`, invoked as `$speckit-constitution`, `$speckit-specify`, `$speckit-plan`, `$speckit-tasks`, and `$speckit-implement`.
- Claude Code skills: `.claude/skills`, invoked as `/speckit-constitution`, `/speckit-specify`, `/speckit-plan`, `/speckit-tasks`, and `/speckit-implement`.
- Both integrations share `.specify/` and `specs/`. Resume the existing feature artifacts when changing agents. Do not run both agents against the same feature artifacts simultaneously.

<!-- SPECKIT START -->

For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/008-connections/plan.md
<!-- SPECKIT END -->
