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

## Sonar prevention and verification

Apply these checks to backend changes. Recurring examples are recorded in
`../../docs/sonar-remediation-current.md` and its historical inventory;
`specs/007-learning-request/sonar-pr20-findings.json` records a separate PR snapshot.
These reports describe their recorded revisions, not the current cloud state.

- Supply an explicit comparator to `sort`/`toSorted` (S2871): numeric order for
  numbers, a deterministic UUID/lock-key order for identifiers, and
  `localeCompare` for displayed text. Preserve existing code-unit ordering for
  command digests and cursors; a locale-based replacement can change their contract.
- Replace nested ternaries with named values or clear branches (S3358). Preserve
  lazy evaluation and PATCH semantics: `undefined` keeps a value; `null` may clear it.
  Prefer optional chaining (S6582) only when its nullish behavior is equivalent.
- Share identical implementations (S4144) and repeated DTO/response fields through
  existing helpers or a focused base class when the contract is truly identical.
  Keep validation, Swagger decorators, nullable fields and endpoint-specific fields.
- Review loop awaits (S9382) for genuine batching: fetch independent rows together
  and use bulk writes when their semantics match. For catalog/Sharing Skill updates,
  acquire locks deterministically and validate requested rows in the same transaction.
  Preserve dependent migrations, transaction writes, sorted wallet/file/stream locks,
  readiness polling and ordered SSE/backpressure; do not blindly use `Promise.all`.
  Explain necessary sequencing with its concrete dependency or locking invariant.
- Reduce cognitive complexity (S3776) with guard clauses and helpers for distinct
  validation, mapping or reconciliation steps. Preserve authorization checks, version
  revalidation, transaction boundaries, wallet arithmetic and atomic audit/outbox writes.
- Give `Error` constructors useful messages (S7722) without secrets. Remove redundant
  `void` on synchronous calls (S3735); keep explicit rejection handling for promises.
- Check SQL findings against PostgreSQL semantics. `VARCHAR` and repeated JSONB keys
  such as `weeklySlots` in CHECK constraints are not Oracle/PLSQL procedural code.
  Preserve published/applied migration history; record analyzer mismatch or a necessary
  literal with the issue key and evidence instead of rewriting migration checksums.
- Verify the analyzed PR/branch revision matches the intended Git head before using
  issue counts. Inspect Quality Gate conditions, new-code duplication metrics and
  analysis warnings independently; zero duplication does not establish a passing gate.
- For Automatic Analysis, keep repository-local tsconfig inheritance resolvable
  without installed workspace symlinks, use UTF-8 source/config files, and declare
  the Python version actually checked for generators. Use only documented settings
  in `.sonarcloud.properties`; it takes effect from the default branch. Unresolved
  external frontend configs require their owner or an installed-dependency CI scan.
- Run focused API lint, type checking, build and affected regression suites. Build
  before tests importing `dist` unless their script already builds. Add behavioral
  checks for changed ordering, PATCH clearing, lock sequencing or financial invariants.
  Local checks and proposed dispositions do not establish cloud closure; require a
  fresh analysis of the fix revision before claiming issues closed or the gate passed.

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
at specs/009-credit-payment/plan.md
<!-- SPECKIT END -->
