# SkillHub Mobile Frontend

React Native + Expo + TypeScript workspace. Current phase: FRONTEND UI FIRST.

## Scope and source of truth

- Read root AGENTS.md and this file first. The user-provided Figma screen is the visual source of truth; inspect it before implementing UI.
- Implement only the requested screen. Match spacing, typography, weights, colors, radius, shadows, assets and alignment; respect safe areas and responsive layout.
- Do not redesign, restructure the app or modify unrelated routes, web or backend code.
- The pasted folder tree is guidance, not authorization to scaffold every folder.

## Architecture

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
