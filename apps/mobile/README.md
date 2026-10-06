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

The bottom tabs now open `/discover`, `/calendar` and `/messages` from home,
profile and each new screen. Discovery follows the signed-in "Yêu cầu học"
screen, with programming/language category filters and request previews.
Calendar supports month navigation, selecting a day, upcoming/history tabs,
local detail previews and opening discovery to find more sessions. Its dates
remain the fixed February–April 2025 sample period from the Figma export; they
are not the current device date. The initial month matches the source's March
view, while the upcoming list shows all sample sessions until a day is selected.
Messages lists accepted-proposal conversations and searches names, skills, post
content and proposal IDs. Each card opens `/chat/[proposalId]`; entering chat
marks its conversation as read in the current local demo session.
Chat supports sending nonempty text locally, reflects the latest sent message
and message count in the list, and keeps messages when returning to a thread.
Changing or ending the demo session resets the message store. There is no
realtime connection, server delivery, file upload or remote persistence.

Discovery cards open `/request/[id]`, and upcoming calendar cards open
`/session/[id]`. Both detail screens resolve the selected sample item by ID and
handle unknown IDs with an empty state. The Figma export contains full request
detail copy only for React; the other requests keep their own known fields and
use marked missing-content placeholders. Session dates, partner, duration and
Credit match the selected sample calendar entry.

Proposal handling, posting requests, public profiles, choosing agreements,
file attachments, schedule-change forms, reports and live classrooms remain
pending. Their actions open local notices; they do not create business records
or move Credit. Online/typing indicators are fixtures from the design.

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
- `src/features/discovery/`: request list, filters, request detail and sample content.
- `src/features/calendar/`: month grid, history, session detail and sample schedule.
- `src/features/messages/`: conversation list, chat and session-scoped local messages.
- `src/components/`: shared native controls, header, account menu, navigation and dialogs.
- `src/constants/`: design tokens and shared navigation labels.
- `assets/`: locally bundled app icons, welcome photograph, fonts and their licenses.

The shared header is `src/components/AppHeader.tsx`; all signed-in screens reuse it.
`AppScreenLayout.tsx` supplies safe areas, navigation, notices, account menu and
logout for the three new screens. Each feature owns its scroll container.
Keep screen implementations in their features and route files limited to navigation.
See `AGENTS.md` for the UI-only implementation rules.

## Discovery, calendar and messages file inventory

Created (16 files):

- `src/app/discover.tsx`, `src/app/calendar.tsx`, `src/app/messages.tsx`
- `src/components/AppScreenLayout.tsx`, `src/components/Tag.tsx`, `src/components/EmptyState.tsx`
- `src/features/discovery/screens/DiscoverScreen.tsx`
- `src/features/discovery/components/LearningRequestCard.tsx`
- `src/features/discovery/mocks/requests.ts`
- `src/features/calendar/screens/CalendarScreen.tsx`
- `src/features/calendar/components/MonthCalendar.tsx`, `SessionCards.tsx`
- `src/features/calendar/mocks/calendar.ts`
- `src/features/messages/screens/MessagesScreen.tsx`
- `src/features/messages/components/ConversationCard.tsx`
- `src/features/messages/mocks/conversations.ts`

Modified (6 files):

- `src/components/AppHeader.tsx`: right action slot and responsive screen title.
- `src/components/BrandLogo.tsx`: optional mark-only mode for narrow headers.
- `src/constants/navigation.ts`: shared destinations for the implemented tabs.
- `src/features/home/screens/HomeScreen.tsx`: navigation to the new screens.
- `src/features/profile/components/ProfileLayout.tsx`: navigation to the new screens.
- `README.md`: implemented scope and this inventory.

No dependencies, lockfiles, web or backend code were changed in this increment.

## Request detail, chat and session detail file inventory

Created (16 files):

- `src/app/request/[id].tsx`, `src/app/chat/[proposalId].tsx`, `src/app/session/[id].tsx`
- `src/components/Badge.tsx`
- `src/features/discovery/screens/RequestDetailScreen.tsx`
- `src/features/discovery/components/RequestDetailSections.tsx`
- `src/features/discovery/mocks/requestDetails.ts`
- `src/features/calendar/screens/SessionDetailScreen.tsx`
- `src/features/calendar/mocks/sessionDetails.ts`
- `src/features/messages/screens/ChatScreen.tsx`
- `src/features/messages/components/ChatHeader.tsx`, `ChatComposer.tsx`, `ChatActionCards.tsx`, `MessageBubble.tsx`
- `src/features/messages/context/MockMessages.tsx`
- `src/features/messages/mocks/chat.ts`

Modified (8 files):

- `src/app/_layout.tsx`: provide the in-memory message store inside the existing demo session.
- `src/components/AppHeader.tsx`: configurable accessible back-button label.
- `src/components/AppScreenLayout.tsx`: detail back navigation and returning to the selected tab.
- `src/components/Icon.tsx`: source SVG paths for send, paperclip and flag.
- `src/features/discovery/screens/DiscoverScreen.tsx`: open the selected request detail.
- `src/features/calendar/screens/CalendarScreen.tsx`: open the selected upcoming session detail.
- `src/features/messages/screens/MessagesScreen.tsx`: open chat and reflect local unread/message state.
- `README.md`: scope, missing-content notes and this inventory.

No dependencies, lockfiles, web or backend code were changed in this increment.
