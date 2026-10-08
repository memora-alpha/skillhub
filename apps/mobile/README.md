# SkillHub Mobile

React Native + Expo + TypeScript app alongside `apps/web`, using Expo Router.
This workspace uses the versioned identity API for account authentication and
profile management. Learning, calendar and chat content remains local while
their backend contracts are introduced.
The welcome, authentication, home and personal profile content is based on the
supplied Complete SkillHub Product Design Figma Make export. The signed-in UI
uses task-based visual hierarchy: a highlighted upcoming session, individual
course/request cards on home, compact white discovery cards with a poster byline,
skill tags and a details action, compact message rows
and open sections. The upcoming-session highlight uses a soft orange surface
with dark text. Calendar dates use explicit seven-cell week rows so weekday
alignment does not depend on percentage rounding or flex wrapping. The session
mentor avatar uses the same identity-based colors as its message and chat avatars.
Avatars show initials in circles with one of five pastel backgrounds and a
contrasting text color, chosen deterministically from the user ID. Demo users
have stable fixture IDs; the signed-in account uses its backend user ID.
Changing a display name or list order does not change its
avatar color. Palette pairs and the selection function live in
`src/constants/avatar.ts`.
Control corners are 6px, all cards and dialogs use shared 8px corners,
and small labels 4px. The signed-in
palette uses one light warm-white background and orange as its primary accent.
Toast overlays use 16px corners, a light surface, a subtle shadow and tinted
status icons, with the same Nunito font and warm palette. Messages wrap, and
the dismiss button keeps a 44px touch target.
New and returning users share the same home sections; new users see initial
values, empty activity states and a collapsible getting-started guide.

Visual references: [Airbnb Trips and Profile](https://news.airbnb.com/product-releases/airbnb-2025-summer-release)
for combining content groups with individual cards, and [Duolingo's learning path](https://blog.duolingo.com/new-duolingo-home-screen-design/)
for prioritizing the next learning action. These inform the hierarchy rather than
copying their branding or adding unsupported content.

## Source of truth

Auth follows the Redis OTP backend update: registration creates the account
only after verification. OTP errors briefly explain the five-error/24-hour
restriction; expired registration can be restarted with the email prefilled.
Code request acknowledgments do not claim email delivery. Recovery verifies OTP
before opening the new-password screen, then resets with a one-use token kept
in memory. The new-password screen has no action to re-enter the consumed OTP.
Password-reset
network/5xx errors advise trying the new password at login because the change
may already have committed. The backend's generic OTP error cannot identify a
ban deadline, so mobile does not display a guessed lock countdown.

- `../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx` defines current business behavior.
- `../../docs/SOURCE_OF_TRUTH.md` tracks the active SRS and historical documents.
- `docs/architecture.md`, `docs/domain-rules.md`, `docs/api-contracts.md`,
  `docs/state-machines.md` and `docs/feature-matrix.md` define the mobile boundary.
- Mobile work must not modify `services/api` unless backend changes are explicitly requested.

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
Run `npm run check-structure`, `npm run check-types` and `npm run lint` here to
check the mobile app.
Add Expo packages with `npx expo install <package> --npm` for SDK-compatible versions.

Mobile uses local ESLint and TypeScript configuration with no `workspace:*`
dependencies, so npm does not install the web or API workspaces.
The rest of the monorepo uses pnpm from the repository root. Root pnpm workspace
commands can also run mobile's scripts:

```powershell
pnpm --filter mobile check-types
pnpm --filter mobile lint
pnpm --filter mobile check-structure
```

Keep `package-lock.json` for independent npm installs. The root `pnpm-lock.yaml`
also records this app's dependencies for monorepo tooling; shared lockfile changes
must be checked against affected workspaces.

Open the Expo QR code in a compatible Expo Go version or development client to
verify on a device. The web preview uses the same React Native components with
React Native Web.

## Implemented UI scope

Welcome buttons navigate to `/register` and `/login`; `/home`, `/profile` and
`/edit-profile` and `/profiles/[userId]` require an authenticated account session.

Registration validates name, email, password requirements, confirmation and
consent, then continues to six-digit email verification. Login uses the identity
API and stores only the refresh credential in Expo SecureStore; access tokens
stay in memory. Google OAuth remains unavailable until the API publishes a
supported route. Home retains its local learning-content previews, notifications,
messages and account menu.

The profile tab and account menu open `/profile`; its edit button opens
`/edit-profile`. Name, headline and bio save through `PATCH /api/v1/me/profile`.
The home greeting, account avatar/name and own-profile summary reflect the
authenticated account. Skills, badges and non-account actions remain design
fixtures until their contracts are available.

Own profile opens a public self-preview at `/profiles/[userId]`, using saved
account fields and an explicit public projection. Other targets remain local
fixtures with loading, unavailable, error/retry and empty states; public API and
skill-list integration remain pending. Public screens expose no target email or
account metadata, and their account menu belongs to the signed-in viewer.
See [spec 003](specs/003-profile-public-profile/plan.md) for scope and fixture IDs.
Run `npm test` for auth and profile tests, or `npm run test:profile` for profile only.

The five main screens live in the `(tabs)` Expo Router group, with a shared
bottom bar. Root-stack and tab transitions have no animation; horizontal back
gestures are disabled on the root stack. Their public paths are unchanged.
Detail screens, chat and profile editing remain in the root stack without the
bottom bar. Cards have no decorative navigation arrows; back buttons, calendar
month controls and the getting-started disclosure retain functional indicators.
The bottom tabs open `/discover`, `/calendar` and `/messages` from home,
profile and each new screen. Discovery follows the signed-in "Yêu cầu học"
screen, with programming/language category filters, an in-screen request search,
advanced Credit/session filters and request previews. Headers do not show search;
screen-level search stays close to the content it filters.
Calendar supports month navigation, selecting a day, upcoming/history tabs,
local detail previews and opening discovery to find more sessions. Its dates
remain the fixed February–April 2025 sample period from the Figma export; they
are not the current device date. The initial month matches the source's March
view, while the upcoming list shows all sample sessions until a day is selected.
Messages lists accepted-proposal conversations and searches names, skills, post
content and proposal IDs. Each card opens `/chat/[proposalId]`; entering chat
marks its conversation as read in the current account session.
Chat supports sending nonempty text locally, reflects the latest sent message
and message count in the list, and keeps messages when returning to a thread.
Changing or ending the account session resets the message store. There is no
realtime connection, server delivery, file upload or remote persistence.

Discovery cards open `/request/[id]`, and upcoming calendar cards open
`/session/[id]`. Both detail screens resolve the selected sample item by ID and
handle unknown IDs with an empty state. The Figma export contains full request
detail copy only for React; the other requests keep their own known fields and
use marked missing-content placeholders. Session dates, partner, duration and
Credit match the selected sample calendar entry.

Three more screens complete the local connection flow:

- `/user/[id]`: public profile, public Sharing Skills/verification labels and
  sample reviews. Request detail opens the correct poster by ID and carries
  the request into the proposal form. Profiles with limited source content
  show missing-data copy rather than another user's biography. Email, phone,
  payment information and private evidence are never shown.
- `/send-proposal`: reply to a request or send a direct invitation from a
  public profile. The form validates a 10–1000-character message, positive
  Credit with at most two decimal places and a positive integer session count.
  Replies require a matching skill in the demo Sharing Skills. It prevents
  duplicate pending proposals and self-proposals; submission shows a local
  success state and opens the Sent tab on demand.
- `/proposals`: Received, Sent, Discussing, Accepted and Closed tabs, empty
  states and navigation to a dedicated detail screen. Request responses and
  direct invitations use the same lifecycle. Received proposals can be accepted/rejected;
  pending sent proposals can be edited or withdrawn. Accept opens the matching local
  conversation and prevents accepting another proposal for the same request.
  Discussing is a UI filter for accepted proposals with local messages, not
  an additional proposal status.
- `/proposal/[id]`: detail for received/sent proposals and direct invitations,
  partner public profile, known source request and original suggestions. Accepted
  proposals reopen Chat; closed and expired proposals retain history. Chat links
  back to the original proposal.
- `/proposal/[id]/edit`: prefilled form for sent `PENDING` proposals only.
  Save updates the original item; cancel discards edits. Message, Credit and session
  validation is shared with the send form. Native forms use the existing keyboard-aware scroll.
- `/proposal/[id]/close?action=reject|withdraw`: review before closing, required
  local rejection reason, cancel and completion state linking to the Closed tab.
  The reason is retained locally, without claiming delivery to another user.

Proposal, send, public-profile and detail/edit/close routes are explicitly registered
under the authenticated stack guard. Unknown IDs and invalid state/direction show
an empty or unavailable state instead of exposing mutation controls.

Proposal and conversation changes remain local to the signed-in account and
reset when the account changes, signs out or the page reloads. Accept never holds Credit,
locks a schedule or creates a Session. Credit, session count and free-text
availability in a proposal remain suggestions for subsequent negotiation.
The provider is composed under `MockMessagesProvider` in `AppProviders`.

Posting requests, choosing agreements, file attachments, schedule-change
forms, reports and live classrooms remain pending. Their actions open local
notices; they do not create business records or move Credit. Online/typing
indicators are fixtures from the design.

Photo selection and the linked wallet, skill management, achievements, reviews
remain pending. Links to unfinished screens show a local notice. Account
settings supports logout-all with pending guards and error feedback. Onboarding
and backend integration for learning/calendar/chat remain pending.

## Environment configuration

Keep local configuration in `apps/mobile/.env`, which is ignored by Git.
The shared template is `apps/mobile/.env.example`. From `apps/mobile`, create
the local file if it does not already exist:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Set `EXPO_PUBLIC_API_URL` to the running API address; configuration validation
accepts the server root or a URL ending in `/api/v1`. On a physical device, use your development machine's
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

- `src/app/`: thin Expo Router routes and navigation configuration.
- `src/providers/`: fonts, safe areas, QueryClient, auth session and shared toast composition.
- `src/features/auth/`: welcome, real registration/verification/login/recovery, validation and session lifecycle.
- `src/features/account/`: typed own-account API and profile contracts.
- `src/features/home/`: shared home content, new-user guide and sample data.
- `src/features/profile/`: authenticated own/edit profile, public self-preview, public projection and other-profile fixtures.
- `src/features/discovery/`: request list, filters, request detail and sample content.
- `src/features/calendar/`: month grid, history, session detail and sample schedule.
- `src/features/messages/`: conversation list, chat and session-scoped local messages.
- `src/features/proposals/`: send form, proposal inbox/detail, fixtures and session-scoped local proposal state.
- `src/features/shell/`: signed-in header, account menu, search, navigation and screen shell.
- `src/components/`: generic native controls and dialogs shared across features.
- `src/constants/`: design tokens and shared navigation labels.
- `src/lib/`: shared HTTP transport, error parsing and secure refresh-token storage.
- `src/mocks/`: local demo content shared by the app shell and multiple features; feature-specific fixtures stay in their owning feature.
- `assets/`: locally bundled app icons, welcome photograph, fonts and their licenses.

The shared signed-in shell lives under `src/features/shell/`; all signed-in
screens reuse it through that feature's public `index.ts`. `AppScreenLayout`
supplies safe areas, navigation, notices, account menu and logout. Each feature
owns its scroll container and exposes its public screen API through `index.ts`.
Keep screen implementations in their features and route files limited to navigation.
See `AGENTS.md` for the UI-only implementation rules.

## Public profile and Proposal file inventory

Created:

- `src/app/user/[id].tsx`, `src/app/send-proposal.tsx`, `src/app/proposals.tsx`
- `src/features/profile/screens/PublicProfileScreen.tsx`, `src/features/profile/mocks/publicProfiles.ts`
- `src/features/proposals/screens/SendProposalScreen.tsx`, `src/features/proposals/screens/ProposalsScreen.tsx`
- `src/features/proposals/components/ProposalCard.tsx`, `src/features/proposals/context/MockProposals.tsx`
- `src/features/proposals/mocks/proposals.ts`, `src/features/proposals/index.ts`

Proposal follow-up adds `src/app/proposal/[id]/{index,edit,close}.tsx`,
`ProposalDetailScreen`, `EditProposalScreen`, `CloseProposalScreen`, `ProposalSummary`,
shared form schemas and guarded pure transitions under `src/features/proposals`.
It updates the inbox, send form, fixtures, account-scoped store, Chat entry point
and authenticated route declarations. `tests/proposal-lifecycle.test.ts` verifies
editing ownership/status, closed-state guards, duplicate acceptance and validation.
See `docs/api-contracts.md` for the remaining Proposal integration gaps.

Updated feature public exports, `AppProviders`, request-detail actions,
the Messages proposal entry point and the message store/Chat to resolve newly
accepted conversations. These local flows now use the shared authenticated
session and are nested under the auth/session gate. Proposal and Chat API
integration remains pending.

## Discovery, calendar and messages file inventory

Created (16 files):

- `src/app/discover.tsx`, `src/app/calendar.tsx`, `src/app/messages.tsx`
- `src/features/shell/components/AppScreenLayout.tsx`, `src/components/Tag.tsx`, `src/components/EmptyState.tsx`
- `src/features/discovery/screens/DiscoverScreen.tsx`
- `src/features/discovery/components/LearningRequestRow.tsx`
- `src/features/discovery/mocks/requests.ts`
- `src/features/calendar/screens/CalendarScreen.tsx`
- `src/features/calendar/components/MonthCalendar.tsx`, `SessionCards.tsx`
- `src/features/calendar/mocks/calendar.ts`
- `src/features/messages/screens/MessagesScreen.tsx`
- `src/features/messages/components/ConversationCard.tsx`
- `src/features/messages/mocks/conversations.ts`

Modified (6 files):

- `src/features/shell/components/AppHeader.tsx`: right action slot and responsive screen title.
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
- `src/features/shell/components/AppHeader.tsx`: configurable accessible back-button label.
- `src/features/shell/components/AppScreenLayout.tsx`: detail back navigation and returning to the selected tab.
- `src/components/Icon.tsx`: source SVG paths for send, paperclip and flag.
- `src/features/discovery/screens/DiscoverScreen.tsx`: open the selected request detail.
- `src/features/calendar/screens/CalendarScreen.tsx`: open the selected upcoming session detail.
- `src/features/messages/screens/MessagesScreen.tsx`: open chat and reflect local unread/message state.
- `README.md`: scope, missing-content notes and this inventory.

No dependencies, lockfiles, web or backend code were changed in this increment.
