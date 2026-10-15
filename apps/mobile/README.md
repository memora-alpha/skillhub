# SkillHub Mobile

SkillHub's React Native application for Android, iOS and web preview, built with
Expo SDK 57, Expo Router and TypeScript. This workspace lives in the SkillHub
monorepo alongside the web application and API service.

## Requirements

- Node.js 22.13+ on the 22.x line, or Node.js 24.3+.
- pnpm 10.24.0, as pinned in the root `package.json`.
- A running SkillHub API for authentication and account features.

## Quick start

From the repository root:

```powershell
pnpm install
cd apps/mobile
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Open `.env` and set an uncommented API URL:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:3001/api/v1
```

Then start Expo:

```powershell
pnpm start
```

Use a compatible Expo Go version or development client on a device. For a local
Android emulator, run `pnpm android`; for browser preview, run `pnpm web`.
The browser preview is separate from `apps/web`. A local iOS simulator requires
macOS and Xcode.

On a physical device, use your development machine's LAN IP instead of
`localhost` and ensure the device can reach the API. The app accepts the server
root or `/api/v1` as the API URL. Keep `.env` local; `EXPO_PUBLIC_` variables are
public and must not contain secrets. See the [API README](../../services/api/README.md)
for backend setup.

## Commands

Run these from `apps/mobile`:

| Command                | Purpose                                     |
| ---------------------- | ------------------------------------------- |
| `pnpm start`           | Start the Expo development server           |
| `pnpm android`         | Open the app on Android                     |
| `pnpm ios`             | Open the app on an iOS simulator            |
| `pnpm web`             | Start the mobile web preview                |
| `pnpm check-types`     | Check TypeScript                            |
| `pnpm lint`            | Run ESLint                                  |
| `pnpm check-structure` | Check source structure and file size limits |
| `pnpm test`            | Run the mobile tests                        |
| `pnpm test:profile`    | Run the profile contract tests              |

Root workspace commands are also supported, for example
`pnpm --filter mobile check-types`.

Add Expo packages with `pnpm exec expo install <package> --pnpm` from this
directory to use SDK-compatible versions. Use pnpm across the monorepo and
commit only the root `pnpm-lock.yaml`; mobile ignores npm, Yarn, Bun and nested
pnpm lockfiles through its own `.gitignore`. Remove any old `apps/mobile/package-lock.json` from your checkout
when switching from npm so package-manager auto-detection stays consistent.

## Feature overview

The app covers account access, profiles and skill-exchange learning flows.
Authentication, own profile, account settings and sharing skill management connect
to the SkillHub API. Sharing skill forms load each skill's ACTIVE level catalog
and save levelId; own/public profiles and offered skills show the catalog name.
Owner evidence upload, scan status, submission and history
use the existing skills endpoints.
Saving a skill returns to the list after the confirmed save; evidence continues
in the signed-in session with sending/pending/retry states on own cards and a
separate result toast. Navigation keeps it running; app background pauses it for
explicit retry, and closing the app does not preserve in-memory drafts.
Preparation/upload use two workers. Cards distinguish preparation, upload, scan
and submission. Slow scans keep uploaded IDs and offer Check again after the
bounded polling window; they do not become upload failures or pending approval.
Images over 2 MB may be compressed at quality 0.9 without resizing; a smaller
valid output is used, with a Keep original choice. PDF/Word and small images keep
their original bytes. Expo Go includes ImageManipulator; an existing development
client needs a new binary to include newly installed native modules.
An app-wide connection screen handles device disconnection and transport failures.
Retry and reconnection reload the open page's data; see
[connection behavior and validation](docs/network-state.md).
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
- Skills delivery: [sharing skills and verification](specs/004-skills-management/spec.md),
  with [plan](specs/004-skills-management/plan.md),
  [tasks](specs/004-skills-management/tasks.md),
  [acceptance checklist](specs/004-skills-management/checklist.md) and
  [validation](specs/004-skills-management/validation.md).
  Implementation and browser fixtures are checked; real API/storage/scan and
  Android/iOS acceptance remain pending in validation.
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
