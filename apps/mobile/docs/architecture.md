# Mobile architecture

## Purpose

The mobile app should follow the same disciplined sequence as the backend: agree on foundation, document contracts, then implement one verifiable feature at a time.

## Workspace boundary

- Mobile lives in `apps/mobile`.
- Backend lives in `services/api`.
- Mobile changes may touch shared packages only when a reusable contract, token or pure utility is genuinely shared.
- Mobile changes must not modify backend source, migrations, specs or Prisma files unless the user explicitly requests backend work.

## Source layout

```text
apps/mobile/
  src/
    app/
    features/
    components/
    providers/
    lib/
    store/
    config/
    theme/
    types/
    utils/
    test/
  assets/
  docs/
  specs/
```

## Layer responsibilities

- `src/app`: Expo Router layouts and route files. Parse params, gate navigation and render feature views.
- `src/features`: SRS-aligned business feature code. Each feature owns its API hooks, schemas, types, views and components.
- `src/components`: Generic UI only. No SRS-specific business rules.
- `src/providers`: App-level providers such as Query, Auth, Theme and Notification.
- `src/lib`: Infrastructure adapters such as HTTP, storage, realtime, upload, notifications and LiveKit token usage.
- `src/store`: Client-only global state. Do not mirror server entities here.
- `src/config`: Runtime config, constants and feature flags.
- `src/theme`: Colors, spacing, typography and platform presentation tokens.
- `src/types`: Very small cross-feature mobile-only types.
- `src/utils`: Pure generic helpers.
- `src/test`: Test render helpers, fixtures and mocks.

## Feature template

`features/settings` owns the signed-in Settings/account screens and static help
content. It consumes Auth through its public API; Auth does not import Settings
or shell layouts. Shared grouped action rows live in `components/ActionGroup`.
Password recovery remains inside Auth, available to guests and signed-in users.

```text
src/features/learning-paths/
  api/
  components/
  hooks/
  schemas/
  types/
  views/
  utils/
  index.ts
```

Create only folders that contain files. A feature does not need every folder on day one.

## Import rules

- Outside code imports a feature through its `index.ts` when possible.
- Declared narrow public entry points are `product-shell/state`,
  `learning-paths/state`, `learning-paths/policy` and `sessions/state`.
  They expose context/hooks or pure policy without loading screen barrels;
  shell, scheduling and session consumers use them to prevent runtime cycles.
  `check-structure` permits only these explicit subpaths; other private imports
  remain blocked.
- A feature must not import private files from another feature.
- `src/lib` must not import UI feature components.
- Route files must not call axios, fetch or business services directly.

## File size rules

- Mobile source files target 250 lines or fewer.
- Route files target 80 lines or fewer.
- Feature views and components target 220 lines or fewer.
- Hooks, API adapters, schemas and utilities target 180 lines or fewer.
- Split files by responsibility before adding broad abstractions.

## Profile and proposal composition

`/profiles/[userId]` preserves saved self-preview and explicit demo targets;
other UUID targets load the authenticated public-profile API and public skills.
Learning Request detail passes its owner ID and request ID to this route; Back
returns through history, falling back to that request or Discover. `/user/[id]`
keeps the existing sample proposal/profile flow. Both routes remain authenticated.
`AppProviders` nests `MockProposalsProvider` inside `MockMessagesProvider` under
`ProfilePreviewProvider` and the session gate. Avatar toasts remain under
`AuthSessionProvider`, so upload feedback continues after leaving the editor.

## Profile skill presentation

Own and public profile skill sections share `ProfileSkillSection` and
`ProfileSkillRow`. The owner supplies private visibility and management actions;
the public section supplies only the API's public projection. Other profile
fixtures use the same presentation without gaining new API integration.
Rows have no separators. Detail shows the centered verification text action
below Delete; submitting the form uses the shared `craft` button variant.
Existing button variants retain their current colors.

Public self-profile skill rows open a separate public detail route and query,
scoped by target userId and Sharing Skill ID. It walks only public skill pages
and reuses SkillCard in detail mode; owner history/actions/evidence components
are never mounted. Hidden/archive confirmations clear public detail data.
Other profile fixtures use SamplePublicSkillRow to open read-only sample details
from their public fields; missing fields remain unavailable rather than invented.

Evidence selection separates the system photo library (`expo-image-picker`)
from PDF/Word documents (`expo-document-picker`). Both feed the same validated
draft and automatic upload/scan/submit pipeline. Picker metadata is normalized
without changing file bytes; unsupported image formats or unreadable sizes are
rejected before upload. Neither picker uploads on selection.

Evidence transfers belong to the Skills session runtime and expose observable
SENDING/WAITING_SCAN/FAILED/PENDING state per Sharing Skill ID. Save records the confirmed
skill before queueing and navigating; Send also queues before returning to detail.
Route changes leave transfers running. App background cancels/retains drafts for
explicit retry; logout/archive removes jobs in scope. Closing the app does not
persist these jobs. Two workers pipeline preparation/upload and drain in-flight
uploads before releasing the retry lock. Owner cards show phase progress, scan
waiting/Check again, pending approval or failed/Retry separately from verification
badges; public cards never mount that state. Scan polling is bounded; exhaustion
keeps file IDs and an informational state, while only confirmed READY can submit.
Retry sits outside the card's detail Pressable to avoid nested action targets.

ImageManipulator/FileSystem re-encode images over 2 MB at JPEG quality 0.9,
preserving pixel dimensions and accepting only smaller validated results. Picker
assets remain originals; owners can keep them before upload. Documents, small
images and uploaded IDs keep their bytes. The shared Checkbox adds an optional
disabled state for this control; existing auth consumers retain their behavior.

## Header actions

The Profile "Hành trình của tôi" shortcut opens `/my-learning`. It owns the
request/path list layout with URL-selected `requests`/`paths` tabs.
Profile uses this single learning entry; the separate "Yêu cầu học của tôi"
shortcut is removed. Its six shortcuts use a two-column grid: Hành trình/Ví,
Tài liệu/Thành tích, Đánh giá/Cài đặt. The UI gallery entry follows bio and skills.
The request tab uses the session-scoped Learning Request API list and its
detail/editor routes; the path tab retains its preview provider and routes.
Legacy `/requests` and `/paths` list routes redirect to the matching hub tab;
Calendar and action maps use the same targets. Path preview data remains labeled;
request API/backend and native acceptance gaps remain tracked in spec 005.

Request creation and own-request detail use history-based Back navigation so
Home, Discover and the profile's learning hub retain their entry context. With
no history, they fall back to Discover; an edit falls back to its request detail.
Saving a new draft replaces the editor with detail, preserving the entry screen
for Back after publishing. Saving an edit returns to the existing detail when
history is available, avoiding a duplicate detail screen.

`AppHeader` shows notifications on main screens. When a layout supplies `onBack`
for a secondary screen, the notification bell and count are omitted. This covers
skills management/forms/details, edit/public profiles, account settings/details
and detail/form screens using `AppScreenLayout`. Back navigation and feature
actions remain available. Chat uses its own header without a notification bell.

## App-wide connection boundary

`ConnectionGate` sits inside `AuthSessionProvider` and outside `SessionGate`.
It covers every route and feature with a full-screen connection view when the
device is offline or the shared HTTP transport reports a network failure.
The underlying router remains mounted, with interaction and accessibility
disabled while covered. Returning online reloads active read queries and keeps
the current route. Saving, uploading and submitting are never replayed by this
boundary. See [network states and validation](network-state.md).

Vertical page scrolls/lists use the shared refreshable components. Keyboard-aware
forms attach native refresh to their existing scroll container, preserving one
scroll owner. `AppRefreshProvider` sits under QueryProvider and refreshes reads;
web gestures stay in PullRefreshBoundary, outside feature/business modules.
See [pull-to-refresh](network-state.md#pull-to-refresh--2026-10-14).

## Calendar presentation

Calendar uses its existing feature palette to match the supplied mobile HTML
reference: warm canvas, compact month card, dot markers
and a text-only gradient Session action. `CalendarSessionCard` is a Calendar-specific
presentation of the validated Session API projection; other Session lists keep
their existing shared card. Calendar now uses the app's shared fonts/typography
and default shell header. Today uses orange digits without a background and is
selected on first opening. Days with sessions have small dots and only the
selected day is circled. No calendar
legend is displayed. The standalone
learning-history route and its navigation links have been removed. Calendar has
no status filter: all sessions for the selected day appear with status on each card.
Its empty-state title uses Nunito Bold and the shared heading typography.

Calendar has one Session list query for the displayed month. Selecting a day
filters that month's validated data locally and never changes the query
key or issues a separate day request. Calendar dots come from all sessions in
that month's response, before filtering by selected day. Changing month and the
existing refresh/focus/resume mechanisms reload
reads. Cap warnings remain honest about the backend's 100-row limit; local day
filtering does not retrieve missing rows. Calendar headings/metadata use the
signed-in list font conventions (Nunito and shared typography tokens).

Session detail follows the supplied detail HTML with shared Nunito typography:
status pill at the top right inside the rounded information card,
orange day/month text without a tile background, and prominent local time/date/duration
before partner avatar/name/role. The entire partner row opens the existing public
profile route with the other participant ID from Session; Back returns to detail.
Timezone/UTC offset labels are hidden; device timezone still drives formatting.
Schedule and partner are unboxed rows inside one white card. Guidance is plain
text outside that card; room is a separate red errorLight block with a solid red
icon tile. Header, confirmation
and action dock have no horizontal divider. The ended-session badge is shortened
to “Chờ xác nhận”, with the full ended guidance below the card.
Date ranges preserve both dates for overnight sessions and local times across
daylight-saving changes.
The action dock stays below the scroll area: upcoming sessions link to the
existing reschedule draft; ended sessions open a confirmation dialog directly on detail.
There is no separate completion page or route.
The action uses the primary terracotta color with white label/icon; confirmed
sessions show a disabled paper button labeled “Đã xác nhận”.
Cancelled or disputed sessions and denied reads have no action dock. Pull refresh remains
available for content and error states. Room access is labeled unavailable;
no room opening time, online/expert verification, session count, cancellation
command, policy or chat flow is inferred from the reference's sample content.

Ended sessions show an inline confirmation section inside the main information
card, with individual clock/check/unknown indicators and authoritative labels.
Cancellation reason and timestamp are grouped in an inline red-tinted section
of that same card. These read sections do not add a cancellation form or command.

Reschedule uses shared `DateTimeField`, `CalendarPicker`, `DateTimeSelector` and
date-choice helpers extracted from the existing Learning Request picker. Its old
feature entry points re-export the shared components/helpers so existing callers
retain their contract. Date and time are selected, staged until Done, and Cancel
preserves the previous value; past date/time cannot be committed. Web uses the
calendar and hour/minute selects, Android the Expo UI time picker, and iOS the
SwiftUI wheel. Form headings/body/hints use Nunito and shared 17/15/13 tokens.
Reschedule opts into solid Date/Time tabs (primary/white selected, surfaceInset
unselected); other DateTimeField consumers retain their default soft variant.
The draft survives read refresh; submission remains gated by the missing backend
proposal/version contract. No package was added or upgraded.

Remaining Session pages use feature-scoped `SessionPage`, panel/copy/button and
empty-state components with Nunito/shared heading 17, body/button 15 and secondary
13 typography. Path session lists have a compact month bar and status badges at
the right of each card; their cap warning does not imply a day query can fetch
additional rows. Detail keeps the shared `SessionConfirmations` inside its
information card, read/mutation notices in the scroll area and the action in its
footer. The footer opens a confirmation dialog; Cancel, outside dismissal and native Back do not send a command. Only
dialog confirmation calls the guarded action. Own confirmed detail, server
COMPLETED or a matching successful receipt displays disabled “Đã xác nhận”,
including on reopening the page. An unknown POST outcome retains the read
reconciliation flow without claiming success or automatically retrying.
Action guards/preflight/reconciliation are unchanged. Room styling uses
the same components, while remaining an explicit preview with local controls.
This does not enable LiveKit or real Session UUID access to mock rooms.
