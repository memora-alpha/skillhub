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

`/profiles/[userId]` uses `PublicProfilePreviewScreen` for saved own-profile
projection and preview fixtures. `/user/[id]` uses `PublicProfileScreen` for the
request/proposal public-profile flow. Both routes remain authenticated.
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

## Header actions

The Profile "Hành trình của tôi" shortcut opens `/my-learning`. It owns the
request/path list layout with URL-selected `requests`/`paths` tabs.
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
