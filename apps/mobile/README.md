# SkillHub Mobile

SkillHub's React Native application for Android, iOS and web preview, built with
Expo SDK 57, Expo Router and TypeScript. This workspace lives in the SkillHub
monorepo alongside the web application and API service.

## Requirements

- Node.js 22.13+ on the 22.x line, or Node.js 24.3+.
- npm for independent mobile development; pnpm for root workspace commands.
- A running SkillHub API for authentication and account features.

## Quick start

From the repository root:

```powershell
cd apps/mobile
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Open `.env` and set an uncommented API URL:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:3001/api/v1
```

Then start Expo:

```powershell
npm start
```

Use a compatible Expo Go version or development client on a device. For a local
Android emulator, run `npm run android`; for browser preview, run `npm run web`.
The browser preview is separate from `apps/web`. A local iOS simulator requires
macOS and Xcode.

On a physical device, use your development machine's LAN IP instead of
`localhost` and ensure the device can reach the API. The app accepts the server
root or `/api/v1` as the API URL. Keep `.env` local; `EXPO_PUBLIC_` variables are
public and must not contain secrets. See the [API README](../../services/api/README.md)
for backend setup.

## Commands

Run these from `apps/mobile`:

| Command                   | Purpose                                     |
| ------------------------- | ------------------------------------------- |
| `npm start`               | Start the Expo development server           |
| `npm run android`         | Open the app on Android                     |
| `npm run ios`             | Open the app on an iOS simulator            |
| `npm run web`             | Start the mobile web preview                |
| `npm run check-types`     | Check TypeScript                            |
| `npm run lint`            | Run ESLint                                  |
| `npm run check-structure` | Check source structure and file size limits |
| `npm test`                | Run the mobile tests                        |
| `npm run test:profile`    | Run the profile contract tests              |

Root workspace commands are also supported, for example
`pnpm --filter mobile check-types`.

Add Expo packages with `npx expo install <package> --npm` to use SDK-compatible
versions. Keep both `apps/mobile/package-lock.json` for independent npm installs
and the root `pnpm-lock.yaml` for monorepo tooling.

## Feature overview

The app covers account access, profiles and skill-exchange learning flows.
Authentication, own profile and account settings connect to the SkillHub API.
Some other flows still use sample data or local state while integration is in
progress.

See the [feature matrix](docs/feature-matrix.md) and
[API contracts](docs/api-contracts.md) for integration scope. Feature behavior,
pending work and test results belong in the [specs](specs/), tasks, checklists
and validation documents linked below.

## Project layout

| Path                            | Responsibility                                           |
| ------------------------------- | -------------------------------------------------------- |
| `src/app/`                      | Thin Expo Router routes and layouts                      |
| `src/features/`                 | Domain screens, components, hooks, adapters and fixtures |
| `src/components/`               | Reusable UI controls                                     |
| `src/providers/`                | Fonts, safe areas, query client, sessions and toasts     |
| `src/lib/`                      | HTTP transport and secure credential storage             |
| `src/config/`, `src/constants/` | Environment validation, theme and navigation             |
| `assets/`                       | Bundled icons, images, fonts and licenses                |
| `docs/`, `specs/`               | Architecture, requirements, tasks and validation         |

Features expose their public APIs through `index.ts`. Keep business logic out of
route files and follow the [mobile architecture](docs/architecture.md).

## Documentation

- Product requirements: [current SRS](../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx)
  and [source of truth](../../docs/SOURCE_OF_TRUTH.md).
- Mobile design: [architecture](docs/architecture.md),
  [domain rules](docs/domain-rules.md) and [state machines](docs/state-machines.md).
- Specs: [foundation](specs/001-mobile-foundation/spec.md),
  [authentication](specs/002-auth-account-shell/spec.md) and
  [profile](specs/003-profile-public-profile/spec.md).
- Learning Request: [spec 005](specs/005-learning-request/spec.md),
  [contract checkpoint](specs/005-learning-request/contracts.md) and
  [review/acceptance checklist](specs/005-learning-request/checklist.md),
  [implementation tasks](specs/005-learning-request/tasks.md) and
  [validation](specs/005-learning-request/validation.md).
- Learning Request checkpoint: [resume after backend readiness](specs/005-learning-request/resume.md).
- Profile delivery: [tasks](specs/003-profile-public-profile/tasks.md),
  [acceptance checklist](specs/003-profile-public-profile/checklist.md) and
  [validation evidence](specs/003-profile-public-profile/validation.md).

## Assets and licenses

The UI is based on the user-provided Complete SkillHub Product Design Figma Make
export. The bundled hero photograph is by Kateryna Hliznitsova / Unsplash.
Fraunces and Nunito are bundled with their SIL Open Font Licenses in
`assets/fonts`.
