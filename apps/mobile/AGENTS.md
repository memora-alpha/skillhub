# SkillHub Mobile Agent Rules

## Scope and source of truth

- This directory is the mobile workspace for the future React Native and Expo app.
- Git and pnpm workspace tooling stay at the repository root.
- Read this file, `README.md`, `docs/architecture.md`, `docs/domain-rules.md`, `docs/api-contracts.md` and `docs/state-machines.md` before mobile work.
- `../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx` is the current business source of truth.
- `../../docs/SOURCE_OF_TRUTH.md` summarizes the active SRS version and historical files.
- Do not invent enum values, endpoint paths, response fields, state transitions or business rules.

## Backend boundary

- Mobile tasks must not modify `../../services/api` unless the user explicitly asks for backend work.
- Missing backend behavior must be recorded as a contract gap in `docs/api-contracts.md`, a spec TODO or the final report.
- If a mobile feature needs a backend contract change, stop at a typed adapter placeholder or documented TODO unless backend changes are explicitly authorized.
- Do not deep-import source from `services/*`.

## Stack baseline

- Use React Native with Expo and TypeScript strict.
- Use Expo Router for file-based routing under `src/app`.
- Use TanStack Query for server state.
- Use Zustand only for client-only state.
- Use React Hook Form and Zod for forms with validation.
- Use one HTTP client under `src/lib/http`.
- Store sensitive persisted credentials in Expo SecureStore.

## Architecture rules

- `src/app` contains thin routes and layouts only.
- Business code lives under `src/features/<domain>`.
- Generic UI lives under `src/components`.
- Infrastructure adapters live under `src/lib`.
- Providers live under `src/providers`.
- Theme tokens live under `src/theme`.
- Feature public APIs export through `index.ts`.
- Avoid importing private files from another feature.

## File size limits

- Keep mobile source files at 250 lines or fewer by default.
- Route files under `src/app` should stay at 80 lines or fewer.
- Feature views and components should stay at 220 lines or fewer.
- Hooks, API adapters, schemas and utility files should stay at 180 lines or fewer.
- Tests may exceed these limits only when table-driven cases remain clearer in one file.
- Generated files, lockfiles and external copied artifacts are exempt.
- If a file must exceed the limit, explain why in the implementation summary and split it in the next related change.

## SRS 1.6 business constraints

- `TWO_WAY` requires two opposing `LearningPlan` records. A creates A to B and B creates B to A; nobody creates the other direction on behalf of the other teacher.
- `ONE_WAY` uses one teacher to learner `LearningPlan`.
- Learner confirms the current version of the plan created by the teacher for that direction.
- Editing a plan increases version and resets the learner confirmation for that plan.
- Schedule proposals are tied to `learningPlanId` and need both users to confirm the same version.
- Session duration is 60 to 180 minutes.
- Reschedule requires both users to confirm at least 60 minutes before `startAt`; otherwise the old schedule remains effective.
- Chat text is never a business confirmation.
- Session completion requires both users to confirm after the session.
- Session completion does not settle Credit by itself.
- `TWO_WAY` final settlement returns 96% held Credit to each original holder and keeps 4% platform fee.
- `ONE_WAY` final settlement pays 96% negotiated Credit to the teacher and keeps 4% platform fee.
- The app must not show withdrawal or cash-out.
- Reputation starts at 50 and is server controlled.
- Public profile must not expose email, phone, payment data, private evidence files or private document URLs.
- Learning Request rejection reasons returned by backend must be visible to the owner.
- Chat attachment limit is 15 MB unless backend contract changes it.

## Before finishing a mobile task

- Run the mobile typecheck, lint and tests when the workspace exists.
- Report files changed, contract assumptions, TODOs and commands run.
- Mention any file that exceeds the configured line limit.
