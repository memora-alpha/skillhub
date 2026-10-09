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
