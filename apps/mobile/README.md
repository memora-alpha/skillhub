# SkillHub Mobile

React Native + Expo + TypeScript app alongside `apps/web`, using Expo Router.
This workspace currently contains frontend UI and local mock interactions only.
It makes no API calls and does not implement backend authentication.
The welcome, authentication, home and personal profile screens follow the supplied
Complete SkillHub Product Design Figma Make export.

Use Node.js 22.13+ on the 22.x line, or Node.js 24.3+.
Node.js 23 is not supported by this React Native version.

## Development

Install and run this app independently, starting at the repository root:

```powershell
cd apps/mobile
npm install
npm start
```

Run `npm run android` to open an Android emulator, or `npm run web` to preview
this mobile app in the browser. This preview is separate from `apps/web`.
Run `npm run check-types` and `npm run lint` here to check the mobile app.
Add Expo packages with `npx expo install <package> --npm` for SDK-compatible versions.

Mobile uses local ESLint and TypeScript configuration with no `workspace:*`
dependencies, so npm does not install the web or API workspaces.
The rest of the monorepo uses pnpm from the repository root. Root pnpm workspace
commands can also run mobile's scripts:

```powershell
pnpm --filter mobile check-types
pnpm --filter mobile lint
```

Keep `package-lock.json` for independent npm installs. The root `pnpm-lock.yaml`
also records this app's dependencies for monorepo tooling; shared lockfile changes
must be checked against affected workspaces.

Open the Expo QR code in a compatible Expo Go version or development client to
verify on a device. The web preview uses the same React Native components with
React Native Web.

## Implemented UI scope

Welcome buttons navigate to `/register` and `/login`; `/home`, `/profile` and
`/edit-profile` require a local demo session.

Registration validates name, email, password requirements, confirmation and
consent, then opens a clearly labelled demo confirmation before showing the
new-user home. Login accepts a valid email and any nonempty password for UI
preview only: `new@test.com` shows the new-user home; other emails show the
returning-user home. Google buttons offer a clearly labelled demo profile,
without OAuth.

Passwords are not saved or sent. Session data exists only in memory and resets
on reload or logout. Remember-me is a local checkbox preview, with no persistent
authentication. Home contains local search, notifications, message previews,
account menu and logout.

The profile tab and account menu open `/profile`; its edit button opens
`/edit-profile`. Name, bio and portfolio edits are validated and stored only in
the current demo session. Saving shows the source success banner and returns to
the profile; cancelling discards unsaved input. The home greeting and account
avatar/name reflect saved changes. Profile stats, verification, skills and badges
are sample values from Figma.

Photo selection and the linked wallet, skill management, achievements, reviews
and settings screens remain pending. Links to unfinished screens show a local
notice. Forgot-password, email verification/OTP, onboarding, real authentication,
APIs and backend integration remain out of scope.

## Environment configuration

Keep local configuration in `apps/mobile/.env`, which is ignored by Git.
The shared template is `apps/mobile/.env.example`. From `apps/mobile`, create
the local file if it does not already exist:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

The current UI requires no environment variables. The template includes a
commented `EXPO_PUBLIC_API_URL` example for future API integration; the app does
not currently read it. On a physical device, use your development machine's
LAN IP instead of `localhost`. Variables prefixed with `EXPO_PUBLIC_` are public
and must not contain secrets.

## Design assets

Source: user-provided Figma Make ZIP, `src/screens/Public.tsx`, `Auth.tsx`,
`Home.tsx`, `CoreScreens.tsx` (OwnProfile/EditProfile), `src/components/Layout.tsx`,
`src/components/ui.tsx` and `src/index.css`.

Hero photograph: Kateryna Hliznitsova / Unsplash, exact URL from that export.
Fonts: Google Fonts, Fraunces and Nunito, under the accompanying SIL Open Font
Licenses in `assets/fonts`. Images and fonts are bundled locally; screens make
no remote asset requests.

The responsive native layout preserves the source sections and copy, with
safe-area insets and narrower header button padding on small phones.

## Current file layout

- `src/app/`: thin Expo Router routes and the root font/safe-area/session providers.
- `src/features/auth/`: welcome, registration, login, validation and the local demo session.
- `src/features/home/`: new/returning user home content and sample data.
- `src/features/profile/`: personal profile, local editing and sample profile data.
- `src/components/`: shared native controls, header, account menu, navigation and dialogs.
- `src/constants/`: design tokens and shared navigation labels.
- `assets/`: locally bundled app icons, welcome photograph, fonts and their licenses.

The shared header is `src/components/AppHeader.tsx`; home and profile reuse it.
Keep screen implementations in their features and route files limited to navigation.
See `AGENTS.md` for the UI-only implementation rules.
