# SkillHub Mobile Frontend Rules

## Scope and source of truth

- This directory is the React Native and Expo mobile workspace.
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
- When backend integration is explicitly requested, use TanStack Query for server state.
- Use Zustand only for client-only state when the feature requires shared client state.
- Use React Hook Form and Zod for forms with validation when those dependencies are present or explicitly authorized.
- Keep any authorized HTTP client under `src/lib/http`.
- Store sensitive persisted credentials in Expo SecureStore when real authentication is authorized.

## Architecture rules

- `src/app` contains thin routes and layouts only.
- Business code lives under `src/features/<domain>`.
- Generic UI lives under `src/components`.
- Infrastructure adapters live under `src/lib`.
- Providers live under `src/providers`.
- Theme tokens live under `src/constants`.
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

## Frontend design workflow

React Native + Expo + TypeScript workspace. Current phase: FRONTEND UI FIRST.

### Visual source of truth

- Read root AGENTS.md and this file first. The user-provided Figma screen is the visual source of truth; inspect it before implementing UI.
- Implement only the requested screen. Match spacing, typography, weights, colors, radius, shadows, assets and alignment; respect safe areas and responsive layout.
- Do not redesign, restructure the app or modify unrelated routes, web or backend code.
- The pasted folder tree is guidance, not authorization to scaffold every folder.

### Frontend architecture details

- src/app/ is for thin Expo Router routes and navigation only.
- Screen UI belongs in src/features/<feature>/screens/; never create src/screens/.
- Feature-specific components and local mock data belong in the owning feature.
- Globally reusable UI belongs in src/components/; design tokens belong in src/constants/.
- Create folders only when needed. Keep small prop types and StyleSheet.create in their component file.
- Keep existing API code and architecture. Reuse dependencies, icons, assets, components and tokens before adding equivalents.

## Frontend UI only

- Use React Native View, Text, Image, Pressable, ScrollView, FlatList and TextInput; no HTML, DOM APIs or web CSS.
- Use local mock data and React state. Local navigation, forms, validation, modals, tabs and selected states are allowed.
- Do not add backend servers, database schemas, API calls/endpoints, real authentication/OTP/payment, WebSocket or LiveKit integrations, Firebase or Supabase.
- Do not install a UI/state/network framework such as NativeBase, React Native Paper, Tamagui, Gluestack, NativeWind, Redux, Zustand, React Query or Axios without an explicit request.
- Do not substitute Figma imagery with unrelated stock assets or emoji icons. Mark a missing asset as temporary rather than inventing a replacement.

## Workflow and checks

1. Inspect package.json, src/app, src/components, src/constants and the affected feature before changes.
2. Report reusable files/components and planned created/modified files before implementation.
3. Match the provided Figma screen and verify its visual output.
4. Run npm run check-types and npm run lint from apps/mobile; fix introduced errors. Root pnpm --filter mobile commands are also supported.
5. Report created/modified files and any unverified behavior.

For mobile-only development, install dependencies with npm install from apps/mobile and keep its package-lock.json. Mobile must not depend on workspace:* packages, so npm can install it independently of web and API. The rest of the repository uses pnpm from the root; retain compatibility with root workspace commands. Add Expo packages through npx expo install <package> --npm from apps/mobile so versions match this workspace's SDK. Do not create ios/android manually or initialize a nested Git repository.
